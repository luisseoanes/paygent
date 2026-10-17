import type { Amount, Mandate } from '@openroute/shared'
import { s, type Row, type Sql } from './rows.ts'

// El árbol de mandatos (tabla mandates). Las reglas (delegar, topes, firma) están en gateway/mandates.ts.

// Todos los montos de un mandato van en su activo (asset_code/asset_scale).
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

export const findMandate = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from mandates where id = $1`, [id])
  return r ? toMandate(r) : undefined
}

/** Escribe la fila tal cual (el dominio la firma antes: gateway/mandates.ts putMandate). */
export const upsertMandateRow = async (signed: Mandate, conn?: Sql) => {
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
}

/** Une el mandato con la cuenta de la persona titular (para el login y los perfiles). */
export const linkHolderUser = async (mandateId: string, userId: string, conn?: Sql) => {
  await s(conn).query(`update mandates set holder_user_id = $2 where id = $1`, [mandateId, userId])
}

export const childrenOf = async (id: string, conn?: Sql) =>
  (await s(conn).query(`select * from mandates where parent_id = $1 order by id`, [id])).map(toMandate)

/** Cadena hoja → raíz (vacía si el mandato no existe). */
export const chainRows = async (id: string, conn?: Sql): Promise<Mandate[]> => {
  const rows = await s(conn).query(
    `with recursive chain as (
       select m.*, 0 as depth from mandates m where m.id = $1
       union all
       select p.*, c.depth + 1 from mandates p join chain c on p.id = c.parent_id
     ) select * from chain order by depth`,
    [id],
  )
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

/** Bloquea las filas hasta el fin de la transacción, en orden de id (dos cadenas con ancestros comunes no se cruzan). */
export const lockMandates = async (ids: string[], conn?: Sql) => {
  await s(conn).query(`select id from mandates where id = any($1::text[]) order by id for update`, [ids])
}

export const mandateExists = async (id: string, conn?: Sql) => (await s(conn).query(`select 1 from mandates where id = $1`, [id])).length > 0

/** La cuenta dueña de un mandato (holder_user_id). */
export const holderUserOf = async (mandateId: string, conn?: Sql) =>
  ((await s(conn).query<{ holder_user_id: string | null }>(`select holder_user_id from mandates where id = $1`, [mandateId]))[0]?.holder_user_id ?? undefined)

/** Cuentas dueñas de algún mandato de la cadena hoja → raíz (la persona, su titular…). */
export const holdersOfChain = async (mandateId: string, conn?: Sql) =>
  (
    await s(conn).query<{ holder_user_id: string }>(
      `with recursive chain as (
         select id, parent_id, holder_user_id from mandates where id = $1
         union all
         select m.id, m.parent_id, m.holder_user_id from mandates m join chain c on m.id = c.parent_id
       ) select holder_user_id from chain where holder_user_id is not null`,
      [mandateId],
    )
  ).map((r) => r.holder_user_id)


/** Mandatos de dispositivos con tope offline y sin revocar (GRD-02). */
export const offlineDevices = async (conn?: Sql) =>
  (await s(conn).query(`select * from mandates where holder_type = 'device' and offline_cap is not null and not revoked`)).map(toMandate)

/** Un beneficiario que enlaza su celular también queda como dueño de la rama de la persona, si aún no tiene. */
export const linkPersonIfFree = async (personId: string, userId: string, conn?: Sql) => {
  await s(conn).query(`update mandates set holder_user_id = $2 where id = $1 and holder_type = 'person' and holder_user_id is null`, [
    personId,
    userId,
  ])
}

/**
 * Borra ramas enteras (en cascada: pagos, PIN, perfiles y llaves; los vales no tienen FK y se borran a mano).
 * Devuelve las cuentas que eran dueñas de algún mandato borrado.
 */
export const deleteBranches = async (ids: string[], conn?: Sql) => {
  const subtree = `with recursive sub as (select id, holder_user_id from mandates where id = any($1::text[])
                   union all select m.id, m.holder_user_id from mandates m join sub on m.parent_id = sub.id)`
  const users = (await s(conn).query<{ u: string }>(`${subtree} select distinct holder_user_id as u from sub where holder_user_id is not null`, [ids])).map(
    (r) => r.u,
  )
  await s(conn).query(`${subtree} delete from vouchers where mandate_id in (select id from sub)`, [ids])
  await s(conn).query(`delete from mandates where id = any($1::text[])`, [ids])
  return users
}
