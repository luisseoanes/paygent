import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { pinsOf, upsertPin } from '../store/secrets.ts'
import type { Sql } from '../store/sql.ts'
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
  await upsertPin(mandateId, hashSecret(pin), conn)
}

/** Busca el PIN más cercano subiendo por la cadena (el PIN de la mamá protege a su Asistente). */
export const checkPin = async (mandateId: string, pin: string) => {
  const ids = (await chainOf(mandateId)).map((m) => m.id)
  const rows = await pinsOf(ids)
  const owner = ids.map((id) => rows.find((r) => r.mandate_id === id)).find(Boolean)
  return owner ? checkSecret(pin, owner) : false
}
