import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { db, save, type Pin } from '../db.ts'
import { chainOf } from './mandates.ts'

export const hashPin = (pin: string): Pin => {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: scryptSync(pin, salt, 32).toString('hex') }
}

export const setPin = (mandateId: string, pin: string) => {
  db.pins[mandateId] = hashPin(pin)
  save()
}

/** Busca el PIN más cercano subiendo por la cadena (el PIN de la mamá protege a su Asistente). */
export const checkPin = (mandateId: string, pin: string) => {
  const owner = chainOf(mandateId).find((m) => db.pins[m.id])
  if (!owner) return false
  const { salt, hash } = db.pins[owner.id]
  return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(pin, salt, 32))
}
