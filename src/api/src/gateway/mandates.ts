import {
  amount as A,
  currentPeriodStart,
  randomId,
  signMandate,
  type Amount,
  type Mandate,
  type MandateNode,
} from '@openroute/shared'
import { sql, type Row, type Sql } from '../store/sql.ts'
import { badRequest, forbidden, notFound } from './errors.ts'
import { gatewayKey } from './keys.ts'

export const ROOT_ID = 'root'

// ─── Fila ↔ Mandate. Todos los montos de un mandato van en su activo (asset_code/asset_scale). ───
const toMandate = (r: Row): Mandate => {
  const amt = (v: unknown): Amount => ({ value: String(v), assetCode: r.asset_code, assetScale: r.asset_scale })
  const opt = (v: unknown) => (v === null || v === undefined ? undefined : amt(v))
  const m: Mandate = {
    id: r.id,
    parentId: r.parent_id,
    holderType: r.holder_type,
    holderId: r.holder_id,
    holderName: r.holder_name,
    maxDebit: amt(r.max_debit),
    interval: r.interval,
    spentInPeriod: amt(r.spent_in_period),
    periodStart: r.period_start,
    categories: r.categories,
    pinThreshold: opt(r.pin_threshold),
    offlineCap: opt(r.offline_cap),
    offlineCapCeiling: opt(r.offline_cap_ceiling),
    canSpend: r.can_spend,
    expiresAt: r.expires_at,
    revoked: r.revoked,
    frozen: r.frozen,
    mode: r.mode ?? undefined,
    signature: r.signature,
  }
  for (const k of ['pinThreshold', 'offlineCap', 'offlineCapCeiling', 'mode'] as const) if (m[k] === undefined) delete m[k]
  return m
}

const s = (conn?: Sql) => conn ?? sql()

export const findMandate = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from mandates where id = $1`, [id])
  return r ? toMandate(r) : undefined
}

export const getMandate = async (id: string, conn?: Sql) => {
  const m = await findMandate(id, conn)
  if (!m) throw notFound(`Mandato ${id}`)
  return m
}

/** Guarda el mandato re-firmado. Toda mutación de un mandato pasa por aquí. */
export const putMandate = async (m: Mandate, conn?: Sql) => {
  const signed = signMandate(m, gatewayKey.secretKey)
  const v = (a?: Amount) => (a ? a.value : null)
  await s(conn).query(
    `insert into mandates (id, parent_id, holder_type, holder_id, holder_name, asset_code, asset_scale, max_debit,
       spent_in_period, interval, period_start, categories, pin_threshold, offline_cap, offline_cap_ceiling, can_spend,
       expires_at, revoked, frozen, signature, mode)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[], $13, $14, $15, $16, $17, $18, $19, $20, $21)
     on conflict (id) do update set parent_id = $2, holder_type = $3, holder_id = $4, holder_name = $5, asset_code = $6,
       asset_scale = $7, max_debit = $8, spent_in_period = $9, interval = $10, period_start = $11, categories = $12::text[],
       pin_threshold = $13, offline_cap = $14, offline_cap_ceiling = $15, can_spend = $16, expires_at = $17,
       revoked = $18, frozen = $19, signature = $20, mode = $21`,
    [
      signed.id,
      signed.parentId,
      signed.holderType,
      signed.holderId,
      signed.holderName,
      signed.maxDebit.assetCode,
      signed.maxDebit.assetScale,
      signed.maxDebit.value,
      signed.spentInPeriod.value,
      signed.interval,
      signed.periodStart,
      signed.categories,
      v(signed.pinThreshold),
      v(signed.offlineCap),
      v(signed.offlineCapCeiling),
      signed.canSpend,
      signed.expiresAt,
      signed.revoked,
      signed.frozen,
      signed.signature,
      signed.mode ?? null,
    ],
  )
  return signed
}

/** Une el mandato con la cuenta de la persona titular (para el login y los perfiles). */
export const linkHolderUser = async (mandateId: string, userId: string, conn?: Sql) => {
  await s(conn).query(`update mandates set holder_user_id = $2 where id = $1`, [mandateId, userId])
}

export const childrenOf = async (id: string, conn?: Sql) =>
  (await s(conn).query(`select * from mandates where parent_id = $1 order by id`, [id])).map(toMandate)

/** Cadena hoja → raíz. */
export const chainOf = async (id: string, conn?: Sql): Promise<Mandate[]> => {
  const rows = await s(conn).query(
    `with recursive chain as (
       select m.*, 0 as depth from mandates m where m.id = $1
       union all
       select p.*, c.depth + 1 from mandates p join chain c on p.id = c.parent_id
     ) select * from chain order by depth`,
    [id],
  )
  if (!rows.length) throw notFound(`Mandato ${id}`)
  return rows.map(toMandate)
}

/** Todos los mandatos que cuelgan de `id` (sin incluirlo). */
export const descendantsOf = async (id: string, conn?: Sql): Promise<Mandate[]> =>
  (
    await s(conn).query(
      `with recursive sub as (
         select m.* from mandates m where m.parent_id = $1
         union all
         select c.* from mandates c join sub on c.parent_id = sub.id
       ) select * from sub`,
      [id],
    )
  ).map(toMandate)

/** Reinicia el gasto si cambió la ventana del interval (renovación mensual / PT5M en la demo). En memoria. */
export const rollPeriod = (m: Mandate, now = new Date()) => {
  const start = currentPeriodStart(m.interval, now).toISOString()
  if (start !== m.periodStart) {
    m.periodStart = start
    m.spentInPeriod = A.zero(m.maxDebit)
  }
  return m
}

/** Lo que de verdad queda disponible: el mínimo a lo largo de toda la cadena. */
export const remainingOf = async (id: string): Promise<Amount> =>
  (await chainOf(id))
    .map((m) => rollPeriod(m))
    .map((m) => A.sub(m.maxDebit, m.spentInPeriod))
    .reduce((min, r) => (A.cmp(r, min) < 0 ? r : min))

export const treeOf = async (id: string): Promise<MandateNode> => {
  const root = rollPeriod(await getMandate(id))
  const all = (await descendantsOf(id)).map((m) => rollPeriod(m))
  const build = (m: Mandate): MandateNode => ({
    ...m,
    children: all
      .filter((c) => c.parentId === m.id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(build),
  })
  return build(root)
}

// ─── GW-03: delegación con invariantes ───
export type DelegateInput = Partial<Omit<Mandate, 'parentId' | 'signature' | 'spentInPeriod' | 'periodStart'>> &
  Pick<Mandate, 'holderType' | 'holderId' | 'maxDebit'>

export const delegate = async (parentId: string, input: DelegateInput, conn?: Sql): Promise<Mandate> => {
  const parent = await getMandate(parentId, conn)
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
    mode: input.mode,
    signature: '',
  }
  if (!child.mode) delete child.mode

  // 1. Suma de hijos ≤ padre
  const siblingsTotal = (await childrenOf(parentId, conn))
    .filter((sib) => !sib.revoked && sib.id !== child.id)
    .reduce((acc, sib) => A.add(acc, sib.maxDebit), A.zero(parent.maxDebit))
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
  return putMandate(child, conn)
}

// ─── GW-07: revocación en cascada ───
export const revoke = async (id: string): Promise<string[]> =>
  sql().tx(async (tx) => {
    const ids = [id, ...(await descendantsOf(id, tx)).map((m) => m.id)]
    for (const mid of ids) await putMandate({ ...(await getMandate(mid, tx)), revoked: true }, tx)
    return ids
  })

export const setFrozen = async (id: string, frozen: boolean) => putMandate({ ...(await getMandate(id)), frozen })

// ─── GW-08: monotonía. Solo restringe; nunca amplía más allá de lo que Juan autorizó. ───
export const restrict = async (id: string, patch: { offlineCap?: Amount; frozen?: boolean }) => {
  const m = await getMandate(id)
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

/**
 * El titular cambia los topes de una rama (sube o baja) sin salirse de su padre: suma de hermanos ≤ padre y nunca por
 * debajo de lo que ya repartió a sus hijos. `offlineCap` es el techo sin señal. La raíz la fija la billetera.
 */
export const setLimits = async (id: string, patch: { maxDebit?: Amount; offlineCap?: Amount }, conn?: Sql) => {
  const m = await getMandate(id, conn)
  if (!m.parentId) throw badRequest('El tope de la raíz es el que firmaste en tu billetera')
  if (m.revoked) throw forbidden('La rama está revocada')
  const valid = (a?: Amount) => !a || (/^\d+$/.test(a.value) && a.assetCode === m.maxDebit.assetCode && a.assetScale === m.maxDebit.assetScale)
  if (!valid(patch.maxDebit) || !valid(patch.offlineCap)) throw badRequest(`Los topes van en ${m.maxDebit.assetCode}`)
  const next = { ...m }
  if (patch.maxDebit) {
    const parent = await getMandate(m.parentId, conn)
    const live = (ms: Mandate[]) => ms.filter((c) => !c.revoked)
    const siblings = live(await childrenOf(parent.id, conn)).filter((c) => c.id !== m.id)
    const sum = (ms: Mandate[]) => ms.reduce((acc, c) => A.add(acc, c.maxDebit), A.zero(m.maxDebit))
    const free = A.sub(parent.maxDebit, sum(siblings))
    if (!A.lte(patch.maxDebit, free)) throw forbidden(`Supera lo que queda por repartir de ${parent.holderName} (${A.format(free)})`)
    const delegated = sum(live(await childrenOf(m.id, conn)))
    if (!A.lte(delegated, patch.maxDebit)) throw forbidden(`Ya repartió ${A.format(delegated)} entre sus propias ramas`)
    next.maxDebit = patch.maxDebit
  }
  // El titular fija el techo sin señal; el tope vigente lo mueve el Guardián por debajo de él.
  if (patch.offlineCap) {
    if (!m.offlineCap) throw badRequest('Esta rama no paga sin señal')
    next.offlineCapCeiling = patch.offlineCap
    if (!A.lte(next.offlineCap!, patch.offlineCap)) next.offlineCap = patch.offlineCap
  }
  // Un tope sin señal nunca supera el de la rama: si se baja la rama, baja con ella.
  for (const k of ['offlineCap', 'offlineCapCeiling'] as const) {
    const cap = next[k]
    if (cap && !A.lte(cap, next.maxDebit)) {
      if (patch.offlineCap) throw badRequest('El tope sin señal no puede superar el de la rama')
      next[k] = next.maxDebit
    }
  }
  return putMandate(next, conn)
}

/**
 * Si un padre quedó por debajo de lo que repartió (el titular firmó un grant menor), sus hijos bajan en proporción, en
 * cascada; los topes sin señal nunca quedan por encima de su rama. Devuelve las ramas que cambiaron.
 */
export const fitChildren = async (id: string, conn?: Sql): Promise<Mandate[]> => {
  const parent = await getMandate(id, conn)
  const kids = (await childrenOf(id, conn)).filter((c) => !c.revoked)
  const total = kids.reduce((acc, c) => acc + BigInt(c.maxDebit.value), 0n)
  const tope = BigInt(parent.maxDebit.value)
  const changed: Mandate[] = []
  if (total > tope)
    for (const c of kids) {
      // Redondeo hacia abajo: la suma nunca pasa del padre.
      const next = { ...c, maxDebit: { ...c.maxDebit, value: String((BigInt(c.maxDebit.value) * tope) / total) } }
      for (const k of ['offlineCap', 'offlineCapCeiling'] as const) if (next[k] && !A.lte(next[k]!, next.maxDebit)) next[k] = next.maxDebit
      changed.push(await putMandate(next, conn))
    }
  for (const c of kids) changed.push(...(await fitChildren(c.id, conn)))
  return changed
}

/** Suma el gasto en toda la cadena (GW-05), en una transacción: o se cuenta en todas las ramas o en ninguna. */
export const applySpend = async (mandateId: string, amount: Amount) =>
  sql().tx(async (tx) => {
    await tx.query(`select id from mandates where id = any($1::text[]) for update`, [(await chainOf(mandateId, tx)).map((m) => m.id)])
    for (const m of await chainOf(mandateId, tx)) {
      rollPeriod(m)
      await putMandate({ ...m, spentInPeriod: A.add(m.spentInPeriod, amount) }, tx)
    }
  })

/** Mandatos de dispositivos con tope offline y sin revocar (GRD-02). */
export const offlineDevices = async () =>
  (await sql().query(`select * from mandates where holder_type = 'device' and offline_cap is not null and not revoked`)).map(toMandate)
