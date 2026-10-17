import { amount as A, randomId, type Merchant, type Payment, type PuntoredCredit } from '@openroute/shared'
import { env } from '../env.ts'
import { emit } from '../feed/bus.ts'
import { fxRate } from '../fx/trm.ts'
import { puntoredClient, type PuntoredClient } from '../puntored/client.ts'
import { creditsOfMerchant, insertCredit, settleCredit } from '../store/puntored.ts'
import { maskKey } from './payout.ts'

// El pago real llega a la wallet que representa a Puntored; aquí Puntored le acredita al tendero sin wallet en su
// llave Bre-B. Paygent solo registra y muestra: no guarda dinero.

const pesosFmt = (n: number) => `$${n.toLocaleString('es-CO')}`

/** Lo que recibió la tienda en pesos: lo que confirmó Open Payments, el precio fijado o, si no, el monto convertido. */
export const pesosRecibidos = (p: Payment) => {
  const cop = [p.receiveAmount, p.price].find((a) => a?.assetCode === 'COP')
  return cop ? Math.round(A.toNumber(cop)) : A.toCop(p.amount, fxRate())
}

/** Acredita una sola vez por pago. Un fallo de Puntored no deshace el pago: queda para retirar en su punto. */
export const acreditarPorPuntored = async (payment: Payment, merchant: Merchant, client: PuntoredClient = puntoredClient(env.PUNTORED_MODE)) => {
  if (merchant.payout?.via !== 'puntored') return
  const { llave } = merchant.payout
  const pesos = pesosRecibidos(payment)
  const comisionPesos = Math.round((pesos * env.PUNTORED_COMISION_PCT) / 100)
  const id = randomId('pnt_')
  if (!(await insertCredit({ id, paymentId: payment.id, merchantId: merchant.id, llave, pesos, comisionPesos }))) return

  const neto = pesos - comisionPesos
  const r = await client
    .acreditar({ ref: id, llave, pesos: neto, comercio: merchant.name })
    .catch((err: Error) => ({ estado: 'fallido' as const, motivo: `Puntored no respondió (${err.message}): el dinero queda para retirar en su punto Puntored` }))
  await settleCredit(id, r)
  await emit({
    mandateId: payment.mandateId,
    actor: { type: 'agent', name: 'Puntored' },
    kind: 'payout',
    merchant: merchant.name,
    reason:
      r.estado === 'acreditado'
        ? `Puntored le acreditó ${pesosFmt(neto)} a ${merchant.name} en su llave Bre-B ${maskKey(llave)} (ref. ${r.ref})`
        : `Puntored no pudo acreditarle ${pesosFmt(neto)} a ${merchant.name}: ${r.motivo}`,
  })
}

/** Lo que ve el tendero: sus acreditaciones, con la llave enmascarada. */
export const acreditacionesDe = async (merchantId: string): Promise<PuntoredCredit[]> =>
  (await creditsOfMerchant(merchantId)).map((c) => ({ ...c, llave: maskKey(c.llave) }))
