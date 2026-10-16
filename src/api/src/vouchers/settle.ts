import {
  amount as A,
  verifyVoucherOffline,
  type Voucher,
  type VoucherSettleResult,
} from '@openroute/shared'
import { getCert, getVoucher, putVoucher, vouchersOfDevices } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { authorize } from '../gateway/authorize.ts'
import { gatewayKey } from '../gateway/keys.ts'
import { getMandate, restrict } from '../gateway/mandates.ts'
import { executePayment } from '../gateway/pay.ts'
import { callAgents } from '../lib/agents.ts'
import { reviewOfflineCaps } from './guardian.ts'

const key = (v: Voucher) => `${v.deviceCert.certId}:${v.counter}`

type GuardianDecision = { voucherId: string; action: 'approve' | 'flag' | 'freeze'; rule: string; explanation: string }

const record = async (v: Voucher, r: VoucherSettleResult) => {
  const stored = { voucher: v, status: r.status, reason: r.reason, paymentId: r.paymentId, receivedAt: new Date().toISOString() }
  // Un replay NO sobreescribe el vale original ya liquidado, pero el intento sí queda en el historial como
  // alerta: si no, tras descongelar el celular el Guardián veía un historial limpio y le SUBÍA el tope.
  if (r.reason === 'replay' && (await getVoucher(key(v)))) await putVoucher(`${key(v)}:replay:${Date.now()}`, stored)
  else await putVoucher(key(v), stored)
  return r
}

const freezeDevice = async (mandateId: string, why: string) => {
  const m = await restrict(mandateId, { frozen: true })
  await emit({ mandateId, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', reason: `Congelé a ${m.holderName}: ${why}` })
}

/** Chequeos duros del gateway (no negociables, no dependen del Guardián). */
const hardChecks = async (v: Voucher): Promise<string | null> => {
  const offline = verifyVoucherOffline(v, gatewayKey.publicKey, new Date(v.createdAt))
  if (!offline.ok) return offline.reason
  const cert = await getCert(v.deviceCert.certId)
  if (!cert || cert.signature !== v.deviceCert.signature) return 'Certificado desconocido'
  if (await getVoucher(key(v))) return 'replay'
  const prev = await getVoucher(`${cert.certId}:${v.counter - 1}`)
  if (prev && A.cmp(A.add(prev.voucher.cumulative, v.amount), v.cumulative) !== 0) return 'Acumulado inconsistente'
  return null
}

/** OFF-03: firma + certificado + contador único + acumulado → Guardián → liquidación real de cada vale. */
export const settleVouchers = async (vouchers: Voucher[]): Promise<VoucherSettleResult[]> => {
  const results: VoucherSettleResult[] = []
  const candidates: Voucher[] = []

  for (const v of [...vouchers].sort((a, b) => a.counter - b.counter)) {
    const problem = await hardChecks(v)
    if (!problem) {
      candidates.push(v)
      continue
    }
    if (problem === 'replay') {
      await freezeDevice(v.deviceCert.mandateId, `el vale #${v.counter} se presentó dos veces (posible doble gasto)`)
    }
    results.push(await record(v, { voucherId: v.voucherId, status: 'rejected', reason: problem }))
  }

  // GRD-01: el Guardián (Python) revisa el lote. Si no responde, se aprueba (los chequeos duros ya pasaron).
  const history = (await vouchersOfDevices([...new Set(candidates.map((c) => c.deviceKeyId))])).map((s) => ({
    ...s.voucher,
    status: s.status,
  }))
  const review = await callAgents<{ decisions: GuardianDecision[] }>('/guardian/evaluate', { vouchers: candidates, history })
  const decisionOf = (v: Voucher) => review?.decisions.find((d) => d.voucherId === v.voucherId)

  for (const v of candidates) {
    const d = decisionOf(v)
    if (d && d.action !== 'approve') {
      await emit({ mandateId: v.deviceCert.mandateId, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', amount: v.amount, reason: d.explanation })
      if (d.action === 'freeze') {
        await freezeDevice(v.deviceCert.mandateId, d.rule)
        results.push(await record(v, { voucherId: v.voucherId, status: 'rejected', reason: d.explanation }))
        continue
      }
    }

    // Los vales ya los aceptó el tendero: no piden PIN. El tope offline ya acotó el riesgo.
    const decision = await authorize({ mandateId: v.deviceCert.mandateId, amount: v.amount, category: v.category, pinOk: true })
    if (decision.result !== 'allow') {
      const reason = decision.result === 'deny' ? (decision.detail ?? decision.reason) : 'needs_pin'
      results.push(await record(v, { voucherId: v.voucherId, status: 'rejected', reason }))
      continue
    }
    try {
      const holder = (await getMandate(v.deviceCert.mandateId)).holderName
      const payment = await executePayment({
        mandateId: v.deviceCert.mandateId,
        merchantWallet: v.merchantWallet,
        amount: v.amount,
        category: v.category,
        reason: `Vale offline #${v.counter} de ${holder}`,
        kind: 'voucher_settled',
      })
      results.push(await record(v, { voucherId: v.voucherId, status: d?.action === 'flag' ? 'flagged' : 'settled', paymentId: payment.id }))
    } catch (err) {
      results.push(await record(v, { voucherId: v.voucherId, status: 'rejected', reason: (err as Error).message }))
    }
  }

  // Con lo que se acaba de liquidar (o rechazar), el Guardián ajusta solo el tope sin señal de esos celulares.
  // El celular recibe el tope nuevo en su próximo certificado, cuando tenga señal.
  await reviewOfflineCaps([...new Set(vouchers.map((v) => v.deviceCert.mandateId))])
  return results
}
