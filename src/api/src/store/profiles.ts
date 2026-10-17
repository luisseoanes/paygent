import type { DeliveryAddress } from '@openroute/shared'
import { s, opt, clean, type Row, type Sql } from './rows.ts'

// Perfiles del Asistente (SMS / chat) y dirección de entrega por raíz.

export interface PhoneProfile {
  /** Canal: el número del SMS o `app:<persona>` para el chat de la app */
  phone: string
  userId?: string
  name: string
  /** Mandato con el que el Asistente paga compras de esta persona */
  mandateId: string
  /** Mandato con el que el Asistente paga consultas al Agente de Inventario */
  dataMandateId: string
  location: { lat: number; lng: number }
  /** Mandato raíz cuya dirección de entrega aplica (la que registró Juan) */
  rootId: string
  /** Chat de la app: la persona cuyas ramas hablan con este perfil (María desde su celular → 'maria') */
  chatFor?: string
}

const toProfile = (r: Row): PhoneProfile =>
  clean({
    phone: r.channel,
    userId: opt(r.user_id),
    name: r.name,
    mandateId: r.mandate_id,
    dataMandateId: r.data_mandate_id,
    location: { lat: r.lat, lng: r.lng },
    rootId: r.root_id,
    chatFor: opt(r.chat_for),
  })

export const insertProfile = async (p: PhoneProfile, conn?: Sql) => {
  await s(conn).query(
    `insert into profiles (channel, user_id, name, mandate_id, data_mandate_id, lat, lng, root_id, chat_for)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [p.phone, p.userId ?? null, p.name, p.mandateId, p.dataMandateId, p.location.lat, p.location.lng, p.rootId, p.chatFor ?? null],
  )
}
export const getProfile = async (channel: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from profiles where channel = $1`, [channel])
  return r ? toProfile(r) : undefined
}
export const profileForChat = async (personMandateIds: string[], conn?: Sql) => {
  const [r] = await s(conn).query(`select * from profiles where chat_for = any($1::text[]) limit 1`, [personMandateIds])
  return r ? toProfile(r) : undefined
}

export const getAddress = async (rootId: string, conn?: Sql): Promise<DeliveryAddress | null> => {
  const [r] = await s(conn).query(`select * from delivery_addresses where root_id = $1`, [rootId])
  return r ? { recipientName: r.recipient_name, address: r.address } : null
}
export const putAddress = async (rootId: string, a: DeliveryAddress, conn?: Sql) => {
  await s(conn).query(
    `insert into delivery_addresses (root_id, recipient_name, address) values ($1, $2, $3)
     on conflict (root_id) do update set recipient_name = $2, address = $3`,
    [rootId, a.recipientName, a.address],
  )
}

/** Quién usa un canal (número del SMS o `app:<persona>`), si alguien; `revoked` si su hoja ya no puede pagar. */
export const channelOwner = async (channel: string, conn?: Sql) =>
  (
    await s(conn).query<{ user_id: string | null; mandate_id: string; revoked: boolean }>(
      `select p.user_id, p.mandate_id, coalesce(m.revoked, true) as revoked
       from profiles p left join mandates m on m.id = p.mandate_id where p.channel = $1`,
      [channel],
    )
  )[0]

/** Los canales de una hoja del Asistente. `smsOnly` deja fuera el chat de la app. */
export const channelsOf = async (mandateId: string, { smsOnly = false } = {}, conn?: Sql) =>
  (
    await s(conn).query<{ channel: string }>(
      `select channel from profiles where mandate_id = $1 ${smsOnly ? 'and chat_for is null' : ''} order by channel`,
      [mandateId],
    )
  ).map((r) => r.channel)

export const moveChannel = async (from: string, to: string, conn?: Sql) => {
  await s(conn).query(`update profiles set channel = $1 where channel = $2`, [to, from])
}

export const deleteProfile = async (channel: string, conn?: Sql) => {
  await s(conn).query(`delete from profiles where channel = $1`, [channel])
}

/** El canal pasa a hablar con otra hoja del Asistente (y su hoja de datos). */
export const relinkProfile = async (channel: string, mandateId: string, dataMandateId: string, userId: string | null, conn?: Sql) => {
  await s(conn).query(`update profiles set mandate_id = $2, data_mandate_id = $3, user_id = coalesce(user_id, $4) where channel = $1`, [
    channel,
    mandateId,
    dataMandateId,
    userId,
  ])
}

/**
 * El SMS de una rama (su hoja del Asistente). Desde un celular, también el de su persona. Por defecto solo el activo;
 * `includeRevoked` encuentra también el de una rama revocada (para apagarlo y liberar el número).
 */
export const smsProfileOfBranch = async (branchId: string, conn?: Sql, { includeRevoked = false } = {}) => {
  const [r] = await s(conn).query<{ channel: string; mandate_id: string }>(
    `select p.channel, p.mandate_id from profiles p join mandates m on m.id = p.mandate_id
     where m.parent_id in (select $1 union select parent_id from mandates where id = $1 and holder_type = 'device')
       and ($2 or not m.revoked) and p.chat_for is null
     order by m.revoked, m.parent_id = $1 desc limit 1`,
    [branchId, includeRevoked],
  )
  return r ? { phone: r.channel, mandateId: r.mandate_id } : undefined
}
