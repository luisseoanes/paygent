import { get, set, createStore } from 'idb-keyval'
import type { DeviceCert, Merchant, Voucher, VoucherSettleStatus } from '@openroute/shared'

// IndexedDB: sobrevive al modo avión y a recargar la PWA.
const store = createStore('openroute', 'kv')

export const idb = {
  get: <T,>(key: string) => get<T>(key, store),
  set: (key: string, value: unknown) => set(key, value, store),
}

// ─── María (dispositivo) ───
export interface DeviceState {
  publicKey: string
  secretKey: string
  cert: DeviceCert | null
  counter: number // último contador usado con el certificado actual
  cumulativeCents: number
  gatewayPublicKey: string
  merchants: Merchant[]
}

// ─── Tendero ───
export interface QueuedVoucher {
  voucher: Voucher
  status: 'pending' | VoucherSettleStatus
  reason?: string
  scannedAt: string
}
