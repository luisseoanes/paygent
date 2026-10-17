import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { clearPinFailures, pinsOf, recordPinFailure, upsertPin } from '../store/secrets.ts'
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

/** Solo compara con el PIN más cercano de la cadena, sin contar fallos (para comprobar qué PIN quedó guardado). */
export const checkPin = async (mandateId: string, pin: string) => {
  const ids = (await chainOf(mandateId)).map((m) => m.id)
  const rows = await pinsOf(ids)
  const owner = ids.map((id) => rows.find((r) => r.mandate_id === id)).find(Boolean)
  return owner ? checkSecret(pin, owner) : false
}

/** Fallos seguidos (en cualquier compra) que bloquean el PIN de un mandato, y por cuánto tiempo. */
export const PIN_MAX_FALLOS = 5
export const PIN_BLOQUEO_MS = 15 * 60_000

/** `locked_now`: este fallo acaba de bloquearlo (para avisar al titular una sola vez). */
export type PinCheck = 'ok' | 'bad' | 'locked' | 'locked_now'

/**
 * Busca el PIN más cercano subiendo por la cadena (el PIN de la mamá protege a su Asistente) y cuenta los fallos en
 * ese PIN: así no se puede probar de 3 en 3 pidiendo compras nuevas. Bloqueado, ni el PIN correcto pasa.
 */
export const verifyPin = async (mandateId: string, pin: string, now = new Date()): Promise<PinCheck> => {
  const ids = (await chainOf(mandateId)).map((m) => m.id)
  const rows = await pinsOf(ids)
  const owner = ids.map((id) => rows.find((r) => r.mandate_id === id)).find(Boolean)
  if (!owner) return 'bad'
  if (owner.locked_until && new Date(owner.locked_until) > now) return 'locked'
  if (checkSecret(pin, owner)) {
    if (owner.failed_attempts || owner.locked_until) await clearPinFailures(owner.mandate_id)
    return 'ok'
  }
  const locked = await recordPinFailure(owner.mandate_id, PIN_MAX_FALLOS, new Date(now.getTime() + PIN_BLOQUEO_MS))
  return locked ? 'locked_now' : 'bad'
}
