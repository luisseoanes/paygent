import {
  randomId,
  type Amount,
  type Category,
  type Delivery,
  type DeliveryRequest,
  type PayRequest,
  type PayResponse,
  type Payment,
} from '@openroute/shared'
import { db, save } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { settle, SettleError } from '../op/settle.ts'
import { authorize } from './authorize.ts'
import { applySpend, chainOf, getMandate } from './mandates.ts'
import { payoutFor } from './payout.ts'
import { checkPin } from './pin.ts'

const PENDING_TTL_MS = 10 * 60_000
const MAX_PIN_ATTEMPTS = 3
/** Cuánto puede alejarse el débito real (cambio de Open Payments) del estimado con la tasa de referencia. */
const MAX_FX_DRIFT = 0.1

const merchantName = (wallet: string) =>
  Object.values(db.merchants).find((m) => m.wallet === wallet)?.name ?? wallet

const isAgentWallet = (wallet: string) => Object.values(db.merchants).some((m) => m.wallet === wallet && m.isAgent)

/**
 * La dirección sale SIEMPRE de lo que registró quien aprobó la raíz del mandato, nunca del agente:
 * así un agente (o un LLM manipulado) no puede desviar un pedido a otra casa.
 */
export const resolveDelivery = (mandateId: string, req?: DeliveryRequest): Delivery | null | undefined => {
  if (!req) return undefined
  if (req.mode === 'pickup') return { mode: 'pickup', code: req.code }
  const root = chainOf(mandateId).at(-1)
  const address = root && db.addresses[root.id]
  if (!address) return null
  return { ...req, mode: 'delivery', recipientName: address.recipientName, address: address.address }
}

/**
 * Mueve el dinero de verdad (OP-04) y deja todo registrado: gasto en la cadena + feed.
 * Se usa desde /pay y desde la liquidación de vales.
 */
export const executePayment = async (input: {
  mandateId: string
  merchantWallet: string
  amount: Amount
  category: Category
  reason: string
  kind?: 'payment' | 'voucher_settled'
  delivery?: Delivery
  price?: Amount
}): Promise<Payment> => {
  const mandate = getMandate(input.mandateId)
  const payment: Payment = {
    id: randomId('pay_'),
    mandateId: input.mandateId,
    merchantWallet: input.merchantWallet,
    amount: input.amount,
    category: input.category,
    reason: input.reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
    delivery: input.delivery,
    price: input.price,
  }
  db.payments[payment.id] = payment
  save()

  const actor = { type: mandate.holderType, name: mandate.holderName }
  const merchant = merchantName(input.merchantWallet)
  // Con wallet: directo al comercio. Sin wallet: a Puntored, que le acredita al tendero.
  const { destination, payout, metadata } = payoutFor(input.merchantWallet)
  payment.payout = payout
  try {
    const result = await settle({
      merchantWallet: destination,
      amount: input.amount,
      price: input.price,
      // Con precio en pesos, el débito real lo fija Open Payments: se vuelve a autorizar con él antes de pagar.
      confirmDebit: (debit) => {
        if (debit.assetCode !== input.amount.assetCode)
          throw new SettleError(`La cotización vino en ${debit.assetCode} y el mandato está en ${input.amount.assetCode}`)
        // Margen: 10 % del estimado, y al menos 5 unidades mínimas para montos de centavos (redondeo de la cotización).
        const estimate = Number(input.amount.value)
        if (Math.abs(Number(debit.value) - estimate) > Math.max(estimate * MAX_FX_DRIFT, 5))
          throw new SettleError('El precio en la moneda de Juan cambió más de 10 % frente al estimado; vuelve a cotizar')
        // El PIN ya se decidió con el estimado; aquí se vuelven a validar topes, categoría y vigencia.
        const decision = authorize({ mandateId: input.mandateId, amount: debit, category: input.category, pinOk: true })
        if (decision.result === 'deny') throw new SettleError(decision.detail ?? decision.reason)
      },
      metadata: { openroute: payment.id, mandate: mandate.id, description: input.reason.slice(0, 100), ...metadata },
    })
    payment.status = 'completed'
    payment.outgoingPaymentId = result.outgoingPaymentId
    payment.amount = result.debitAmount // lo que de verdad se le debitó a Juan
    payment.receiveAmount = result.receiveAmount
    applySpend(input.mandateId, result.debitAmount)
    emit({
      mandateId: mandate.id,
      actor,
      kind: input.kind ?? (isAgentWallet(input.merchantWallet) ? 'agent_to_agent' : 'payment'),
      amount: result.debitAmount,
      merchant,
      reason: input.reason,
      delivery: input.delivery,
      payout,
    })
  } catch (err) {
    payment.status = 'failed'
    const why = err instanceof SettleError ? err.message : String(err)
    emit({ mandateId: mandate.id, actor, kind: 'denied', amount: input.amount, merchant, reason: `Pago fallido: ${why}` })
    throw new SettleError(why)
  } finally {
    save()
  }
  return payment
}

/** GW-05 + GW-06: autoriza → (PIN) → liquida. */
export const pay = async (req: PayRequest): Promise<PayResponse> => {
  let { mandateId, merchantWallet, amount, category, reason, price } = req
  let deliveryReq = req.delivery
  let pinOk = false

  if (req.pendingId) {
    const pending = db.pendings[req.pendingId]
    if (!pending || new Date(pending.expiresAt) < new Date())
      return { result: 'deny', reason: 'not_found', detail: 'La compra pendiente no existe o venció' }
    if (pending.mandateId !== mandateId) return { result: 'deny', reason: 'not_found', detail: 'Mandato distinto' }
    if (!req.pin || !checkPin(mandateId, req.pin)) {
      pending.attempts++
      if (pending.attempts >= MAX_PIN_ATTEMPTS) delete db.pendings[pending.id]
      save()
      return { result: 'deny', reason: 'bad_pin', detail: `PIN incorrecto (${pending.attempts}/${MAX_PIN_ATTEMPTS})` }
    }
    ;({ merchantWallet, amount, category, reason, price } = pending)
    deliveryReq = pending.delivery
    delete db.pendings[pending.id]
    pinOk = true
  } else if (req.pin) {
    if (!checkPin(mandateId, req.pin)) return { result: 'deny', reason: 'bad_pin', detail: 'PIN incorrecto' }
    pinOk = true
  }

  const delivery = resolveDelivery(mandateId, deliveryReq)
  if (delivery === null)
    return { result: 'deny', reason: 'no_address', detail: 'No hay dirección de entrega registrada por Juan' }

  const decision = authorize({ mandateId, amount, category, pinOk })

  if (decision.result === 'deny') {
    const m = db.mandates[mandateId]
    if (m)
      emit({
        mandateId,
        actor: { type: m.holderType, name: m.holderName },
        kind: 'denied',
        amount,
        merchant: merchantName(merchantWallet),
        reason: decision.detail ?? decision.reason,
      })
    return decision
  }

  if (decision.result === 'needs_pin') {
    const pendingId = randomId('pend_')
    db.pendings[pendingId] = {
      id: pendingId,
      mandateId,
      merchantWallet,
      amount,
      category,
      reason,
      delivery: deliveryReq,
      price,
      attempts: 0,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    }
    save()
    return { result: 'needs_pin', pendingId }
  }

  try {
    const payment = await executePayment({ mandateId, merchantWallet, amount, category, reason, delivery, price })
    return { result: 'allow', paymentId: payment.id }
  } catch (err) {
    return { result: 'deny', reason: 'payment_failed', detail: String((err as Error).message) }
  }
}
