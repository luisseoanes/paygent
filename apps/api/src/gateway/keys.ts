import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateKeyPair, type KeyPair } from '@openroute/shared'
import { env } from '../env.ts'

// GW-02: llave ed25519 del gateway. Se guarda aparte de db.json para que /demo/reset
// no invalide los certificados que ya tienen los celulares.
const FILE = join(env.DATA_DIR, 'gateway-key.json')

const loadOrCreate = (): KeyPair => {
  if (process.env.VITEST) return generateKeyPair()
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf8'))
  const kp = generateKeyPair()
  mkdirSync(env.DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(kp, null, 2))
  return kp
}

export const gatewayKey = loadOrCreate()
