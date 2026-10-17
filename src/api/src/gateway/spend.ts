import { amount as A, type Amount, type AuthDecision } from '@openroute/shared'
import { lockMandates } from '../store/mandates.ts'
import { sql, type Sql } from '../store/sql.ts'
import { authorizeChain, type AuthorizeInput } from './authorize.ts'
import { chainOf, putMandate } from './mandates.ts'

/** Lo reservado en cada mandato de la cadena, con el periodo en que se contó (para devolverlo solo en ese). */
export interface Reservation {
  mandateId: string
  amount: Amount
  periods: Record<string, string>
}

/** Bloquea la cadena entera (en orden de id: dos cadenas que comparten ancestros no se bloquean en cruz). */
const lockChain = async (mandateId: string, tx: Sql) => {
  await lockMandates((await chainOf(mandateId, tx)).map((m) => m.id), tx)
  return chainOf(mandateId, tx)
}

/**
 * GW-05: autoriza y suma el gasto en toda la cadena en la misma transacción, ANTES de mover el dinero. Así dos pagos
 * a la vez no leen el mismo disponible. Si el pago luego falla, se devuelve con releaseSpend.
 */
export const reserveSpend = async (input: AuthorizeInput): Promise<{ decision: AuthDecision; reservation?: Reservation }> =>
  sql().tx(async (tx) => {
    const chain = await lockChain(input.mandateId, tx).catch(() => null)
    if (!chain) return { decision: { result: 'deny', reason: 'not_found' } as AuthDecision }
    const decision = authorizeChain(chain, input) // también pasa cada mandato a su periodo vigente
    if (decision.result !== 'allow') return { decision }
    const periods: Record<string, string> = {}
    for (const m of chain) {
      await putMandate({ ...m, spentInPeriod: A.add(m.spentInPeriod, input.amount) }, tx)
      periods[m.id] = m.periodStart
    }
    return { decision, reservation: { mandateId: input.mandateId, amount: input.amount, periods } }
  })

/** Devuelve lo reservado de un pago que no se hizo. Si el periodo ya cambió, no hay nada que devolver en ese mandato. */
export const releaseSpend = async ({ mandateId, amount, periods }: Reservation) =>
  sql().tx(async (tx) => {
    for (const m of await lockChain(mandateId, tx)) {
      if (periods[m.id] !== m.periodStart) continue
      const left = A.cmp(m.spentInPeriod, amount) > 0 ? A.sub(m.spentInPeriod, amount) : A.zero(m.spentInPeriod)
      await putMandate({ ...m, spentInPeriod: left }, tx)
    }
  })
