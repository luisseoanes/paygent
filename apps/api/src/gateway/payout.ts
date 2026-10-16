import type { Payout } from '@openroute/shared'
import { db } from '../db.ts'
import { env } from '../env.ts'

export const merchantByAddress = (address: string) => Object.values(db.merchants).find((m) => m.wallet === address)

/** "3105550101" → "310•••0101": la llave completa no se muestra en el feed. */
export const maskKey = (llave: string) => (llave.length > 6 ? `${llave.slice(0, 3)}•••${llave.slice(-4)}` : llave)

/**
 * A dónde va el dinero de verdad para una dirección de cobro:
 * - comercio con wallet de Open Payments → directo a su wallet;
 * - comercio sin wallet → a la wallet de Puntored, con el comercio y su llave Bre-B en el metadata,
 *   para que Puntored le acredite al tendero por su red.
 */
export const payoutFor = (address: string): { destination: string; payout: Payout; metadata: Record<string, string> } => {
  const m = merchantByAddress(address)
  if (m?.payout?.via === 'puntored')
    return {
      destination: env.WALLET_PUNTORED,
      payout: m.payout,
      metadata: { payoutVia: 'puntored', comercio: m.id, llaveBreB: m.payout.llave },
    }
  const wallet = m?.payout?.via === 'wallet' ? m.payout.wallet : address
  return { destination: wallet, payout: { via: 'wallet', wallet }, metadata: {} }
}

export const describePayout = (p: Payout) =>
  p.via === 'puntored' ? `por Puntored a la llave Bre-B ${maskKey(p.llave)}` : 'directo a su wallet'
