import { randomId, type Amount, type Category, type PayRequest, type PayResponse, type Payment } from '@openroute/shared'
import { db, save } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { settle, SettleError } from '../op/settle.ts'
import { authorize } from './authorize.ts'
import { applySpend, getMandate } from './mandates.ts'
import { checkPin } from './pin.ts'

const PENDING_TTL_MS = 10 * 60_000
const MAX_PIN_ATTEMPTS = 3

const merchantName = (wallet: string) =>
  Object.values(db.merchants).find((m) => m.wallet === wallet)?.name ?? wallet

const isAgentWallet = (wallet: string) => Object.values(db.merchants).some((m) => m.wallet === wallet && m.isAgent)

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
  }
  db.payments[payment.id] = payment
  save()

  const actor = { type: mandate.holderType, name: mandate.holderName }
  const merchant = merchantName(input.merchantWallet)
  try {
    const result = await settle({
      merchantWallet: input.merchantWallet,
      amount: input.amount,
      metadata: { openroute: payment.id, mandate: mandate.id, description: input.reason.slice(0, 100) },
    })
    payment.status = 'completed'
    payment.outgoingPaymentId = result.outgoingPaymentId
    applySpend(input.mandateId, input.amount)
    emit({
      mandateId: mandate.id,
      actor,
      kind: input.kind ?? (isAgentWallet(input.merchantWallet) ? 'agent_to_agent' : 'payment'),
      amount: input.amount,
      merchant,
      reason: input.reason,
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
  let { mandateId, merchantWallet, amount, category, reason } = req
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
    ;({ merchantWallet, amount, category, reason } = pending)
    delete db.pendings[pending.id]
    pinOk = true
  } else if (req.pin) {
    if (!checkPin(mandateId, req.pin)) return { result: 'deny', reason: 'bad_pin', detail: 'PIN incorrecto' }
    pinOk = true
  }

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
      attempts: 0,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    }
    save()
    return { result: 'needs_pin', pendingId }
  }

  try {
    const payment = await executePayment({ mandateId, merchantWallet, amount, category, reason })
    return { result: 'allow', paymentId: payment.id }
  } catch (err) {
    return { result: 'deny', reason: 'payment_failed', detail: String((err as Error).message) }
  }
}
