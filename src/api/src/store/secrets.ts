import type { KeyPair } from '@openroute/shared'
import { s, type Sql } from './rows.ts'

// Secretos con hash o llaves: PIN por mandato (scrypt) y la llave ed25519 del gateway.

export interface StoredSecret {
  salt: string
  hash: string
}

/** Un PIN nuevo empieza sin intentos fallidos ni bloqueo. */
export const upsertPin = async (mandateId: string, { salt, hash }: StoredSecret, conn?: Sql) => {
  await s(conn).query(
    `insert into pins (mandate_id, salt, hash) values ($1, $2, $3)
     on conflict (mandate_id) do update set salt = $2, hash = $3, failed_attempts = 0, locked_until = null`,
    [mandateId, salt, hash],
  )
}

/** Los PIN de varios mandatos (la cadena de uno): el más cercano a la hoja manda. */
export const pinsOf = async (mandateIds: string[], conn?: Sql) =>
  s(conn).query<{ mandate_id: string; salt: string; hash: string; failed_attempts: number; locked_until: Date | string | null }>(
    `select * from pins where mandate_id = any($1::text[])`,
    [mandateIds],
  )

/** Suma un fallo; al llegar a `max` bloquea hasta `lockUntil` y reinicia la cuenta. true si este fallo lo bloqueó. */
export const recordPinFailure = async (mandateId: string, max: number, lockUntil: Date, conn?: Sql) => {
  const [r] = await s(conn).query<{ locked: boolean }>(
    `update pins set
       locked_until = case when failed_attempts + 1 >= $2 then $3::timestamptz else locked_until end,
       failed_attempts = case when failed_attempts + 1 >= $2 then 0 else failed_attempts + 1 end
     where mandate_id = $1
     returning locked_until = $3::timestamptz as locked`,
    [mandateId, max, lockUntil.toISOString()],
  )
  return !!r?.locked
}

export const clearPinFailures = async (mandateId: string, conn?: Sql) => {
  await s(conn).query(`update pins set failed_attempts = 0, locked_until = null where mandate_id = $1`, [mandateId])
}

export const getGatewayKeyRow = async (conn?: Sql): Promise<KeyPair | undefined> => {
  const [r] = await s(conn).query(`select public_key, secret_key from gateway_keys where id = 'gateway'`)
  return r ? { publicKey: r.public_key, secretKey: r.secret_key } : undefined
}

/** No pisa una llave que ya exista (otra instancia pudo crearla primero). */
export const insertGatewayKeyRow = async (kp: KeyPair, conn?: Sql) => {
  await s(conn).query(`insert into gateway_keys (id, public_key, secret_key) values ('gateway', $1, $2) on conflict (id) do nothing`, [
    kp.publicKey,
    kp.secretKey,
  ])
}
