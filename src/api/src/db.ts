import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Amount,
  Category,
  DeliveryAddress,
  DeliveryRequest,
  DeviceCert,
  FeedEvent,
  Mandate,
  Merchant,
  Payment,
  Voucher,
} from '@openroute/shared'
import { env } from './env.ts'

// "Base de datos" en memoria con respaldo en .data/db.json.
// Es suficiente para un hackathon: cero instalación, reset instantáneo y se puede inspeccionar a mano.
// Si algún día hace falta SQLite, solo cambia este archivo.

export interface Agent {
  id: string
  name: string
  role: 'assistant' | 'inventory' | 'guardian'
  walletAddress?: string
  publicKey?: string
  apiKey: string
}

export interface DeviceKey {
  deviceKeyId: string
  mandateId: string
  publicKey: string
}

export interface Pin {
  salt: string
  hash: string
}

export interface PhoneProfile {
  phone: string
  name: string
  /** Mandato con el que el Asistente paga compras de esta persona */
  mandateId: string
  /** Mandato con el que el Asistente paga consultas al Agente de Inventario */
  dataMandateId: string
  location: { lat: number; lng: number }
  /** Mandato raíz cuya dirección de entrega aplica (la que registró Juan) */
  rootId: string
}

export interface Pending {
  id: string
  mandateId: string
  merchantWallet: string
  amount: Amount
  category: Category
  reason: string
  delivery?: DeliveryRequest
  price?: Amount
  attempts: number
  expiresAt: string
}

export interface StoredVoucher {
  voucher: Voucher
  status: 'settled' | 'rejected' | 'flagged'
  reason?: string
  paymentId?: string
  receivedAt: string
}

export interface RootGrant {
  walletAddress: string
  accessToken: string
  manageUrl: string
  continueUri: string
  continueToken: string
}

export interface PendingGrant {
  walletAddress: string
  authServer: string
  continueUri: string
  continueToken: string
  clientNonce: string
  finishNonce: string
  maxDebit: Amount
  interval: string
}

export interface DB {
  mandates: Record<string, Mandate>
  agents: Record<string, Agent>
  devices: Record<string, DeviceKey>
  certs: Record<string, DeviceCert>
  pins: Record<string, Pin>
  phones: Record<string, PhoneProfile>
  /** Dirección de entrega por mandato raíz: solo quien aprueba la raíz la cambia, nunca un agente */
  addresses: Record<string, DeliveryAddress>
  merchants: Record<string, Merchant>
  vouchers: Record<string, StoredVoucher> // clave: `${certId}:${counter}`
  payments: Record<string, Payment>
  pendings: Record<string, Pending>
  feed: FeedEvent[]
  rootGrant: RootGrant | null
  pendingGrant: PendingGrant | null
  /** Versión de la semilla con la que se armó esta base (ver SEED_VERSION en demo/seed.ts) */
  seedVersion?: string
}

const FILE = join(env.DATA_DIR, 'db.json')

export const emptyDb = (): DB => ({
  mandates: {},
  agents: {},
  devices: {},
  certs: {},
  pins: {},
  phones: {},
  addresses: {},
  merchants: {},
  vouchers: {},
  payments: {},
  pendings: {},
  feed: [],
  rootGrant: null,
  pendingGrant: null,
})

const load = (): DB | null => {
  if (process.env.VITEST || !existsSync(FILE)) return null
  try {
    return { ...emptyDb(), ...JSON.parse(readFileSync(FILE, 'utf8')) }
  } catch {
    return null
  }
}

export let db: DB = load() ?? emptyDb()
export const isFreshDb = () => Object.keys(db.mandates).length === 0

export const replaceDb = (next: DB) => {
  db = next
  save()
}

let timer: NodeJS.Timeout | null = null
/** Llama a save() después de cada mutación. Escribe a disco con debounce. */
export const save = () => {
  if (process.env.VITEST) return
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    mkdirSync(env.DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(db, null, 2))
  }, 150)
}
