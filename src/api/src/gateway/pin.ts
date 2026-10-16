import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { sql, type Sql } from '../store/sql.ts'
import { chainOf } from './mandates.ts'

export interface Secret {
  salt: string
  hash: string
}

/** scrypt con salt: lo usan los PIN y las contraseñas. Nunca se guarda el valor en claro. */
export const hashSecret = (value: string): Secret => {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: scryptSync(value, salt, 32).toString('hex') }
}

export const checkSecret = (value: string, { salt, hash }: Secret) =>
  timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(value, salt, 32))

export const setPin = async (mandateId: string, pin: string, conn?: Sql) => {
  const { salt, hash } = hashSecret(pin)
  await (conn ?? sql()).query(
    `insert into pins (mandate_id, salt, hash) values ($1, $2, $3) on conflict (mandate_id) do update set salt = $2, hash = $3`,
    [mandateId, salt, hash],
  )
}

/** Busca el PIN más cercano subiendo por la cadena (el PIN de la mamá protege a su Asistente). */
export const checkPin = async (mandateId: string, pin: string) => {
  const ids = (await chainOf(mandateId)).map((m) => m.id)
  const rows = await sql().query<{ mandate_id: string; salt: string; hash: string }>(
    `select * from pins where mandate_id = any($1::text[])`,
    [ids],
  )
  const owner = ids.map((id) => rows.find((r) => r.mandate_id === id)).find(Boolean)
  return owner ? checkSecret(pin, owner) : false
}
