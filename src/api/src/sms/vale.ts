import { amount as A, decodeVoucherSms } from '@openroute/shared'
import { db } from '../db.ts'
import { env } from '../env.ts'
import { settleVouchers } from '../vouchers/settle.ts'

const MOTIVOS: Record<string, string> = { replay: 'este vale ya se había cobrado' }

/** Vale recibido por SMS → mismo camino que POST /vouchers/settle. Nunca pasa por el LLM. */
export const settleVoucherSms = async (text: string): Promise<string> => {
  let voucher
  try {
    voucher = decodeVoucherSms(text, {
      cert: (certId) => db.certs[certId],
      wallets: [...new Set(Object.values(db.merchants).map((m) => m.wallet))],
    })
  } catch (err) {
    return `No pude leer el vale (${(err as Error).message}). Reenvíelo completo desde la app.`
  }

  const [r] = await settleVouchers([voucher])
  if (r?.status === 'rejected') return `Vale rechazado: ${MOTIVOS[r.reason ?? ''] ?? r.reason}`
  const comercio = Object.values(db.merchants).find((m) => m.wallet === voucher.merchantWallet)?.name ?? 'el comercio'
  const monto = A.formatCop(A.toCop(voucher.amount, env.FX_COP_PER_USD))
  return `Vale liquidado: ${monto} a ${comercio}${r?.status === 'flagged' ? ' (el Guardián lo marcó para revisión)' : ''}`
}
