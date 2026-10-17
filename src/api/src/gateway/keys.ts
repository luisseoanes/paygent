import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateKeyPair, type KeyPair } from '@openroute/shared'
import { env } from '../env.ts'
import { getGatewayKeyRow, insertGatewayKeyRow } from '../store/secrets.ts'

// GW-02: llave ed25519 del gateway, en la tabla gateway_keys. No se borra al resembrar la demo, para no
// invalidar los certificados que ya tienen los celulares. Se carga una vez al arrancar (loadGatewayKey).

export let gatewayKey: KeyPair = generateKeyPair()

/** Lee la llave de la base; si no hay, importa la del volumen anterior (.data/gateway-key.json) o crea una. */
export const loadGatewayKey = async () => {
  const stored = await getGatewayKeyRow()
  if (stored) return (gatewayKey = stored)
  const legacy = join(env.DATA_DIR, 'gateway-key.json')
  const kp: KeyPair = !process.env.VITEST && existsSync(legacy) ? JSON.parse(readFileSync(legacy, 'utf8')) : generateKeyPair()
  await insertGatewayKeyRow(kp)
  // Si otra instancia la creó primero, gana la guardada.
  return (gatewayKey = (await getGatewayKeyRow()) ?? kp)
}
