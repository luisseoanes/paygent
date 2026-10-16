import {
  amount as A,
  currentPeriodStart,
  randomId,
  signMandate,
  type Amount,
  type Mandate,
  type MandateNode,
} from '@openroute/shared'
import { db, save } from '../db.ts'
import { badRequest, forbidden, notFound } from './errors.ts'
import { gatewayKey } from './keys.ts'

export const ROOT_ID = 'root'

export const getMandate = (id: string) => {
  const m = db.mandates[id]
  if (!m) throw notFound(`Mandato ${id}`)
  return m
}

/** Guarda el mandato re-firmado. Toda mutación de un mandato pasa por aquí. */
export const putMandate = (m: Mandate) => {
  db.mandates[m.id] = signMandate(m, gatewayKey.secretKey)
  save()
  return db.mandates[m.id]
}

export const childrenOf = (id: string) => Object.values(db.mandates).filter((m) => m.parentId === id)

/** Cadena hoja → raíz. */
export const chainOf = (id: string): Mandate[] => {
  const chain: Mandate[] = []
  let cur: Mandate | undefined = getMandate(id)
  while (cur) {
    chain.push(cur)
    cur = cur.parentId ? db.mandates[cur.parentId] : undefined
  }
  return chain
}

/** Reinicia el gasto si cambió la ventana del interval (renovación mensual / PT5M en la demo). */
export const rollPeriod = (m: Mandate, now = new Date()) => {
  const start = currentPeriodStart(m.interval, now).toISOString()
  if (start !== m.periodStart) {
    m.periodStart = start
    m.spentInPeriod = A.zero(m.maxDebit)
  }
  return m
}

/** Lo que de verdad queda disponible: el mínimo a lo largo de toda la cadena. */
export const remainingOf = (id: string): Amount => {
  const chain = chainOf(id).map((m) => rollPeriod(m))
  return chain
    .map((m) => A.sub(m.maxDebit, m.spentInPeriod))
    .reduce((min, r) => (A.cmp(r, min) < 0 ? r : min))
}

export const treeOf = (id: string): MandateNode => {
  const m = rollPeriod(getMandate(id))
  return { ...m, children: childrenOf(id).map((c) => treeOf(c.id)) }
}

export const descendantsOf = (id: string): Mandate[] =>
  childrenOf(id).flatMap((c) => [c, ...descendantsOf(c.id)])

// ─── GW-03: delegación con invariantes ───
export type DelegateInput = Partial<Omit<Mandate, 'parentId' | 'signature' | 'spentInPeriod' | 'periodStart'>> &
  Pick<Mandate, 'holderType' | 'holderId' | 'maxDebit'>

export const delegate = (parentId: string, input: DelegateInput): Mandate => {
  const parent = getMandate(parentId)
  if (parent.revoked) throw forbidden('El mandato padre está revocado')

  const child: Mandate = {
    id: input.id ?? randomId('m_'),
    parentId,
    holderType: input.holderType,
    holderId: input.holderId,
    holderName: input.holderName ?? input.holderId,
    maxDebit: input.maxDebit,
    interval: input.interval ?? parent.interval,
    spentInPeriod: A.zero(input.maxDebit),
    periodStart: '',
    categories: input.categories ?? parent.categories,
    pinThreshold: input.pinThreshold,
    offlineCap: input.offlineCap,
    offlineCapCeiling: input.offlineCapCeiling ?? input.offlineCap,
    canSpend: input.canSpend ?? true,
    expiresAt: input.expiresAt ?? parent.expiresAt,
    revoked: false,
    frozen: false,
    signature: '',
  }

  // 1. Suma de hijos ≤ padre
  const siblingsTotal = childrenOf(parentId)
    .filter((s) => !s.revoked && s.id !== child.id)
    .reduce((acc, s) => A.add(acc, s.maxDebit), A.zero(parent.maxDebit))
  if (!A.lte(A.add(siblingsTotal, child.maxDebit), parent.maxDebit)) {
    throw forbidden('La suma de los sub-mandatos supera el tope del padre')
  }
  // 2. Categorías ⊆ padre
  const extra = child.categories.filter((c) => !parent.categories.includes(c))
  if (extra.length) throw forbidden(`Categorías no permitidas por el padre: ${extra.join(', ')}`)
  // 3. Vigencia ≤ padre
  if (new Date(child.expiresAt) > new Date(parent.expiresAt)) throw forbidden('La vigencia supera la del padre')
  // Topes internos coherentes
  if (child.offlineCap && !A.lte(child.offlineCap, child.maxDebit)) throw badRequest('offlineCap > maxDebit')
  if (child.offlineCapCeiling && !A.lte(child.offlineCapCeiling, child.maxDebit))
    throw badRequest('offlineCapCeiling > maxDebit')

  rollPeriod(child)
  return putMandate(child)
}

// ─── GW-07: revocación en cascada ───
export const revoke = (id: string): string[] => {
  const ids = [id, ...descendantsOf(id).map((m) => m.id)]
  for (const mid of ids) putMandate({ ...getMandate(mid), revoked: true })
  return ids
}

export const setFrozen = (id: string, frozen: boolean) => putMandate({ ...getMandate(id), frozen })

// ─── GW-08: monotonía. Solo restringe; nunca amplía más allá de lo que Juan autorizó. ───
export const restrict = (id: string, patch: { offlineCap?: Amount; frozen?: boolean }) => {
  const m = getMandate(id)
  if (patch.frozen === false) throw forbidden('Restrict no puede descongelar: solo Juan (POST /mandates/:id/unfreeze)')
  const next = { ...m }
  if (patch.frozen) next.frozen = true
  if (patch.offlineCap) {
    // El techo es lo que Juan autorizó (offlineCapCeiling). El Guardián se mueve debajo de él.
    const ceiling = m.offlineCapCeiling ?? m.offlineCap
    if (!ceiling) throw forbidden('Este mandato no tiene tope offline')
    if (!A.lte(patch.offlineCap, ceiling)) throw forbidden('No se puede ampliar el tope offline más allá de lo autorizado')
    if (!A.lte(patch.offlineCap, m.maxDebit)) throw forbidden('El tope offline no puede superar el tope del mandato')
    next.offlineCap = patch.offlineCap
  }
  return putMandate(next)
}

/** Suma el gasto en toda la cadena (GW-05). */
export const applySpend = (mandateId: string, amount: Amount) => {
  for (const m of chainOf(mandateId)) {
    rollPeriod(m)
    putMandate({ ...m, spentInPeriod: A.add(m.spentInPeriod, amount) })
  }
}
