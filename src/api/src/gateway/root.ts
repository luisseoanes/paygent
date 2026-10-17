import { amount as A, type Amount } from '@openroute/shared'
import { emit } from '../feed/bus.ts'
import { sql, type Sql } from '../store/sql.ts'
import { deleteOrphanUsers } from '../store/accounts.ts'
import { deleteBranches, lockMandates } from '../store/mandates.ts'
import { childrenOf, descendantsOf, fitChildren, getMandate, putMandate } from './mandates.ts'

/**
 * Raíz revocada que se vuelve a firmar: arranca sin beneficiarios. Borra las ramas revocadas (en cascada: pagos, PIN,
 * perfiles y llaves) y las cuentas de beneficiario que se quedan sin rama, para poder registrarlas de nuevo.
 */
export const purgeRevokedBranches = async (rootId: string, tx: Sql) => {
  const branches = (await childrenOf(rootId, tx)).filter((c) => c.revoked).map((c) => c.id)
  if (!branches.length) return 0
  await deleteOrphanUsers(await deleteBranches(branches, tx), tx)
  return branches.length
}

/**
 * OP-03: el mandato raíz refleja exactamente lo que el titular firmó en su billetera. Si es menos de lo repartido, sus
 * ramas bajan en proporción en la misma transacción; si la raíz venía revocada, arranca sin beneficiarios.
 */
export const applySignedRoot = async (rootId: string, signed: { maxDebit: Amount; interval: string }) => {
  const { root, purged, adjusted } = await sql().tx(async (tx) => {
    // El árbol entero bloqueado: ningún gasto se cuela entre la lectura y el reajuste de topes.
    await lockMandates([rootId, ...(await descendantsOf(rootId, tx)).map((m) => m.id)], tx)
    const root = await getMandate(rootId, tx)
    const purged = root.revoked ? await purgeRevokedBranches(rootId, tx) : 0
    await putMandate({ ...root, maxDebit: signed.maxDebit, interval: signed.interval, revoked: false, frozen: false }, tx)
    return { root, purged, adjusted: await fitChildren(rootId, tx) }
  })
  const actor = { type: 'person' as const, name: root.holderName }
  await emit({
    mandateId: rootId,
    actor,
    kind: 'grant',
    amount: signed.maxDebit,
    reason: `${root.holderName} aprobó el mandato raíz en su billetera: máx. ${A.format(signed.maxDebit)} por periodo${purged ? ' (empieza sin beneficiarios)' : ''}`,
  })
  const direct = adjusted.filter((m) => m.parentId === rootId)
  if (direct.length)
    await emit({
      mandateId: rootId,
      actor,
      kind: 'guardian',
      reason: `El mandato nuevo es menor que lo repartido: los topes bajaron en proporción (${direct.map((m) => `${m.holderName} ${A.format(m.maxDebit)}`).join(', ')})`,
    })
}
