import type { KeyPair } from '@openroute/shared'
import { s, type Sql } from './rows.ts'

// Secretos con hash o llaves: PIN por mandato (scrypt) y la llave ed25519 del gateway.

export interface StoredSecret {
  salt: string
  hash: string
}

export const upsertPin = async (mandateId: string, { salt, hash }: StoredSecret, conn?: Sql) => {
  await s(conn).query(
    `insert into pins (mandate_id, salt, hash) values ($1, $2, $3) on conflict (mandate_id) do update set salt = $2, hash = $3`,
    [mandateId, salt, hash],
  )
}

/** Los PIN de varios mandatos (la cadena de uno): el más cercano a la hoja manda. */
export const pinsOf = async (mandateIds: string[], conn?: Sql) =>
  s(conn).query<{ mandate_id: string; salt: string; hash: string }>(`select * from pins where mandate_id = any($1::text[])`, [mandateIds])

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
