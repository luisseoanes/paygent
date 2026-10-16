import {
  randomId,
  type Amount,
  type AuthDecision,
  type Category,
  type Delivery,
  type DeliveryRequest,
  type PayRequest,
  type PayResponse,
  type Payment,
} from '@openroute/shared'
import {
  deletePayment,
  deletePending,
  getAddress,
  getPending,
  insertPayment,
  insertPending,
  merchantByWallet,
  setPendingAttempts,
  updatePayment,
} from '../db.ts'
import { emit } from '../feed/bus.ts'
import { settle, SettleError } from '../op/settle.ts'
import { authorize } from './authorize.ts'
import { applySpend, chainOf, findMandate, getMandate } from './mandates.ts'
import { payoutFor } from './payout.ts'
import { checkPin } from './pin.ts'

const PENDING_TTL_MS = 10 * 60_000
const MAX_PIN_ATTEMPTS = 3

/** El débito real cotizado no pasa la autorización (pide PIN o excede un tope): no se movió dinero. */
class NotAuthorized extends SettleError {
  constructor(
    public decision: Exclude<AuthDecision, { result: 'allow' }>,
    public debit: Amount,
  ) {
    super(decision.result === 'deny' ? (decision.detail ?? decision.reason) : 'Requiere PIN')
  }
}

const merchantName = async (wallet: string) => (await merchantByWallet(wallet))?.name ?? wallet
const isAgentWallet = async (wallet: string) => !!(await merchantByWallet(wallet))?.isAgent

/**
 * La dirección sale SIEMPRE de lo que registró quien aprobó la raíz del mandato, nunca del agente:
 * así un agente (o un LLM manipulado) no puede desviar un pedido a otra casa.
 */
export const resolveDelivery = async (mandateId: string, req?: DeliveryRequest): Promise<Delivery | null | undefined> => {
  if (!req) return undefined
  if (req.mode === 'pickup') return { mode: 'pickup', code: req.code }
  const root = (await chainOf(mandateId)).at(-1)
  const address = root && (await getAddress(root.id))
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
  /** Precio en la moneda del comercio: `amount` es solo el estimado y se autoriza con el débito real cotizado */
  price?: Amount
  pinOk?: boolean
}): Promise<Payment> => {
  const mandate = await getMandate(input.mandateId)
  const rootId = (await chainOf(input.mandateId)).at(-1)!.id
  const actor = { type: mandate.holderType, name: mandate.holderName }
  const merchant = await merchantName(input.merchantWallet)
  // Con wallet: directo al comercio. Sin wallet: a Puntored, que le acredita al tendero.
  const { destination, payout, metadata } = await payoutFor(input.merchantWallet)
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
    payout,
  }
  await insertPayment(payment)

  try {
    const result = await settle({
      rootId,
      merchantWallet: destination,
      amount: input.amount,
      price: input.price,
      // Con precio en pesos, lo que cuesta de verdad lo cotiza Open Payments con su cambio (el Test Wallet usa
      // ~3.180 COP/USD, no los 4.000 de referencia). Con ESE débito se deciden el PIN y los topes, antes de pagar.
      confirmDebit: input.price
        ? async (debit) => {
            if (debit.assetCode !== input.amount.assetCode)
              throw new SettleError(`La cotización vino en ${debit.assetCode} y el mandato está en ${input.amount.assetCode}`)
            const decision = await authorize({ mandateId: input.mandateId, amount: debit, category: input.category, pinOk: input.pinOk })
            if (decision.result !== 'allow') throw new NotAuthorized(decision, debit)
          }
        : undefined,
      // OP-06: el pago tardó más de lo que esperamos; aquí se sabe si llegó. El gasto ya contado no se
      // devuelve: el tope queda consumido (lo seguro) y Juan ve en el feed que el comercio no cobró.
      onLateOutcome: async (outcome) => {
        payment.status = outcome === 'completed' ? 'completed' : 'failed'
        await updatePayment(payment)
        if (outcome !== 'completed')
          await emit({
            mandateId: mandate.id,
            actor,
            kind: 'denied',
            amount: payment.amount,
            merchant,
            reason: `Pago fallido: ${outcome === 'failed' ? 'no llegó al comercio' : 'el comercio no lo recibió a tiempo'}`,
          })
      },
      metadata: { openroute: payment.id, mandate: mandate.id, description: input.reason.slice(0, 100), ...metadata },
    })
    // OP-06: `completed` solo si el comercio ya recibió el dinero (el Inventario cobra con esto, INV-03).
    payment.status = result.confirmed ? 'completed' : 'pending'
    payment.outgoingPaymentId = result.outgoingPaymentId
    payment.amount = result.debitAmount // lo que de verdad se le debitó a Juan
    payment.receiveAmount = result.receiveAmount
    await updatePayment(payment)
    await applySpend(input.mandateId, result.debitAmount)
    await emit({
      mandateId: mandate.id,
      actor,
      kind: input.kind ?? ((await isAgentWallet(input.merchantWallet)) ? 'agent_to_agent' : 'payment'),
      amount: result.debitAmount,
      merchant,
      reason: input.reason,
      delivery: input.delivery,
      payout,
    })
  } catch (err) {
    if (err instanceof NotAuthorized) {
      await deletePayment(payment.id) // no hubo pago: /pay decide si pide PIN o lo niega
      throw err
    }
    payment.status = 'failed'
    await updatePayment(payment)
    const why = err instanceof SettleError ? err.message : String(err)
    await emit({ mandateId: mandate.id, actor, kind: 'denied', amount: input.amount, merchant, reason: `Pago fallido: ${why}` })
    throw new SettleError(why)
  }
  return payment
}

/** GW-05 + GW-06: autoriza → (PIN) → liquida. */
export const pay = async (req: PayRequest): Promise<PayResponse> => {
  let { mandateId, merchantWallet, amount, category, reason, price } = req
  let deliveryReq = req.delivery
  let pinOk = false

  if (req.pendingId) {
    const pending = await getPending(req.pendingId)
    if (!pending || new Date(pending.expiresAt) < new Date())
      return { result: 'deny', reason: 'not_found', detail: 'La compra pendiente no existe o venció' }
    if (pending.mandateId !== mandateId) return { result: 'deny', reason: 'not_found', detail: 'Mandato distinto' }
    if (!req.pin || !(await checkPin(mandateId, req.pin))) {
      const attempts = pending.attempts + 1
      if (attempts >= MAX_PIN_ATTEMPTS) await deletePending(pending.id)
      else await setPendingAttempts(pending.id, attempts)
      return { result: 'deny', reason: 'bad_pin', detail: `PIN incorrecto (${attempts}/${MAX_PIN_ATTEMPTS})` }
    }
    ;({ merchantWallet, amount, category, reason, price } = pending)
    deliveryReq = pending.delivery
    await deletePending(pending.id)
    pinOk = true
  } else if (req.pin) {
    if (!(await checkPin(mandateId, req.pin))) return { result: 'deny', reason: 'bad_pin', detail: 'PIN incorrecto' }
    pinOk = true
  }

  const delivery = await resolveDelivery(mandateId, deliveryReq)
  if (delivery === null)
    return { result: 'deny', reason: 'no_address', detail: 'No hay dirección de entrega registrada por Juan' }

  const deny = async (decision: Extract<AuthDecision, { result: 'deny' }>, shown: Amount) => {
    const m = await findMandate(mandateId)
    if (m)
      await emit({
        mandateId,
        actor: { type: m.holderType, name: m.holderName },
        kind: 'denied',
        amount: shown,
        merchant: await merchantName(merchantWallet),
        reason: decision.detail ?? decision.reason,
      })
    return decision
  }
  const askPin = async (): Promise<PayResponse> => {
    const pendingId = randomId('pend_')
    await insertPending({
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
    })
    return { result: 'needs_pin', pendingId }
  }

  // Con precio en la moneda del comercio, `amount` es solo un estimado (tasa de referencia): el tope y el PIN
  // se deciden con el débito real cotizado (en executePayment). Aquí solo se descarta lo que no depende del monto.
  const estimateOnly = !!price
  const decision = await authorize({ mandateId, amount, category, pinOk })
  if (decision.result === 'deny' && !(estimateOnly && decision.reason === 'over_limit')) return deny(decision, amount)
  if (decision.result === 'needs_pin' && !estimateOnly) return askPin()

  try {
    const payment = await executePayment({ mandateId, merchantWallet, amount, category, reason, delivery, price, pinOk })
    return { result: 'allow', paymentId: payment.id }
  } catch (err) {
    if (err instanceof NotAuthorized)
      return err.decision.result === 'needs_pin' ? askPin() : deny(err.decision, err.debit)
    return { result: 'deny', reason: 'payment_failed', detail: String((err as Error).message) }
  }
}
