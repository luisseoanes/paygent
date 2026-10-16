import {
  amount as A,
  verifyVoucherOffline,
  type Voucher,
  type VoucherSettleResult,
} from '@openroute/shared'
import { db, save } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { authorize } from '../gateway/authorize.ts'
import { gatewayKey } from '../gateway/keys.ts'
import { getMandate, restrict } from '../gateway/mandates.ts'
import { executePayment } from '../gateway/pay.ts'
import { callAgents } from '../lib/agents.ts'

const key = (v: Voucher) => `${v.deviceCert.certId}:${v.counter}`

type GuardianDecision = { voucherId: string; action: 'approve' | 'flag' | 'freeze'; rule: string; explanation: string }

const record = (v: Voucher, r: VoucherSettleResult) => {
  // Un replay NO sobreescribe el vale original ya liquidado.
  if (!db.vouchers[key(v)] || r.reason !== 'replay')
    db.vouchers[key(v)] = { voucher: v, status: r.status, reason: r.reason, paymentId: r.paymentId, receivedAt: new Date().toISOString() }
  save()
  return r
}

const freezeDevice = (mandateId: string, why: string) => {
  const m = restrict(mandateId, { frozen: true })
  emit({ mandateId, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', reason: `Congelé a ${m.holderName}: ${why}` })
}

/** Chequeos duros del gateway (no negociables, no dependen del Guardián). */
const hardChecks = (v: Voucher): string | null => {
  const offline = verifyVoucherOffline(v, gatewayKey.publicKey, new Date(v.createdAt))
  if (!offline.ok) return offline.reason
  const cert = db.certs[v.deviceCert.certId]
  if (!cert || cert.signature !== v.deviceCert.signature) return 'Certificado desconocido'
  if (db.vouchers[key(v)]) return 'replay'
  const prev = db.vouchers[`${cert.certId}:${v.counter - 1}`]
  if (prev && A.cmp(A.add(prev.voucher.cumulative, v.amount), v.cumulative) !== 0) return 'Acumulado inconsistente'
  return null
}

/** OFF-03: firma + certificado + contador único + acumulado → Guardián → liquidación real de cada vale. */
export const settleVouchers = async (vouchers: Voucher[]): Promise<VoucherSettleResult[]> => {
  const results: VoucherSettleResult[] = []
  const candidates: Voucher[] = []

  for (const v of [...vouchers].sort((a, b) => a.counter - b.counter)) {
    const problem = hardChecks(v)
    if (!problem) {
      candidates.push(v)
      continue
    }
    if (problem === 'replay') {
      freezeDevice(v.deviceCert.mandateId, `el vale #${v.counter} se presentó dos veces (posible doble gasto)`)
    }
    results.push(record(v, { voucherId: v.voucherId, status: 'rejected', reason: problem }))
  }

  // GRD-01: el Guardián (Python) revisa el lote. Si no responde, se aprueba (los chequeos duros ya pasaron).
  const history = Object.values(db.vouchers)
    .filter((s) => candidates.some((c) => c.deviceKeyId === s.voucher.deviceKeyId))
    .map((s) => ({ ...s.voucher, status: s.status }))
  const review = await callAgents<{ decisions: GuardianDecision[] }>('/guardian/evaluate', { vouchers: candidates, history })
  const decisionOf = (v: Voucher) => review?.decisions.find((d) => d.voucherId === v.voucherId)

  for (const v of candidates) {
    const d = decisionOf(v)
    if (d && d.action !== 'approve') {
      emit({ mandateId: v.deviceCert.mandateId, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', amount: v.amount, reason: d.explanation })
      if (d.action === 'freeze') {
        freezeDevice(v.deviceCert.mandateId, d.rule)
        results.push(record(v, { voucherId: v.voucherId, status: 'rejected', reason: d.explanation }))
        continue
      }
    }

    // Los vales ya los aceptó el tendero: no piden PIN. El tope offline ya acotó el riesgo.
    const decision = authorize({ mandateId: v.deviceCert.mandateId, amount: v.amount, category: v.category, pinOk: true })
    if (decision.result !== 'allow') {
      const reason = decision.result === 'deny' ? (decision.detail ?? decision.reason) : 'needs_pin'
      results.push(record(v, { voucherId: v.voucherId, status: 'rejected', reason }))
      continue
    }
    try {
      const holder = getMandate(v.deviceCert.mandateId).holderName
      const payment = await executePayment({
        mandateId: v.deviceCert.mandateId,
        merchantWallet: v.merchantWallet,
        amount: v.amount,
        category: v.category,
        reason: `Vale offline #${v.counter} de ${holder}`,
        kind: 'voucher_settled',
      })
      results.push(record(v, { voucherId: v.voucherId, status: d?.action === 'flag' ? 'flagged' : 'settled', paymentId: payment.id }))
    } catch (err) {
      results.push(record(v, { voucherId: v.voucherId, status: 'rejected', reason: (err as Error).message }))
    }
  }
  return results
}
