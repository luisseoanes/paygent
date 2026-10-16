import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateKeyPair, type KeyPair } from '@openroute/shared'
import { env } from '../env.ts'
import { sql } from '../store/sql.ts'

// GW-02: llave ed25519 del gateway, en la tabla gateway_keys. No se borra al resembrar la demo, para no
// invalidar los certificados que ya tienen los celulares. Se carga una vez al arrancar (loadGatewayKey).

export let gatewayKey: KeyPair = generateKeyPair()

/** Lee la llave de la base; si no hay, importa la del volumen anterior (.data/gateway-key.json) o crea una. */
export const loadGatewayKey = async () => {
  const [row] = await sql().query(`select public_key, secret_key from gateway_keys where id = 'gateway'`)
  if (row) {
    gatewayKey = { publicKey: row.public_key, secretKey: row.secret_key }
    return gatewayKey
  }
  const legacy = join(env.DATA_DIR, 'gateway-key.json')
  const kp: KeyPair = !process.env.VITEST && existsSync(legacy) ? JSON.parse(readFileSync(legacy, 'utf8')) : generateKeyPair()
  await sql().query(`insert into gateway_keys (id, public_key, secret_key) values ('gateway', $1, $2) on conflict (id) do nothing`, [
    kp.publicKey,
    kp.secretKey,
  ])
  gatewayKey = kp
  return gatewayKey
}
