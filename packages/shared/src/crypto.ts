import nacl from 'tweetnacl'
import type { DeviceCert, Mandate, Voucher } from './types.ts'

// Mismo código en el navegador (PWA tendero/María) y en Node (gateway). OFF-01.

// ─── base64 sin dependencias (funciona en Node ≥16 y navegador) ───
export const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
export const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const utf8 = (s: string) => new TextEncoder().encode(s)

/** JSON canónico: claves ordenadas recursivamente, sin espacios. */
export const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(',')}}`
}

export interface KeyPair {
  publicKey: string // base64
  secretKey: string // base64
}

export const generateKeyPair = (): KeyPair => {
  const kp = nacl.sign.keyPair()
  return { publicKey: toB64(kp.publicKey), secretKey: toB64(kp.secretKey) }
}

export const keyPairFromSeed = (seedB64: string): KeyPair => {
  const kp = nacl.sign.keyPair.fromSeed(fromB64(seedB64))
  return { publicKey: toB64(kp.publicKey), secretKey: toB64(kp.secretKey) }
}

export const signPayload = (payload: unknown, secretKeyB64: string) =>
  toB64(nacl.sign.detached(utf8(canonicalize(payload)), fromB64(secretKeyB64)))

export const verifyPayload = (payload: unknown, signatureB64: string, publicKeyB64: string) => {
  try {
    return nacl.sign.detached.verify(utf8(canonicalize(payload)), fromB64(signatureB64), fromB64(publicKeyB64))
  } catch {
    return false
  }
}

// ─── Mandatos ───
// La firma cubre todo menos el gasto del periodo (cambia con cada pago) y la propia firma.
const mandatePayload = ({ signature: _s, spentInPeriod: _sp, periodStart: _ps, ...rest }: Mandate) => rest

export const signMandate = (m: Mandate, gatewaySecretKey: string): Mandate => ({
  ...m,
  signature: signPayload(mandatePayload(m), gatewaySecretKey),
})
export const verifyMandate = (m: Mandate, gatewayPublicKey: string) =>
  verifyPayload(mandatePayload(m), m.signature, gatewayPublicKey)

// ─── Certificados de dispositivo ───
export const signDeviceCert = (cert: Omit<DeviceCert, 'signature'>, gatewaySecretKey: string): DeviceCert => ({
  ...cert,
  signature: signPayload(cert, gatewaySecretKey),
})
export const verifyDeviceCert = ({ signature, ...cert }: DeviceCert, gatewayPublicKey: string) =>
  verifyPayload(cert, signature, gatewayPublicKey)

// ─── Vales ───
export const signVoucher = (v: Omit<Voucher, 'signature'>, deviceSecretKey: string): Voucher => ({
  ...v,
  signature: signPayload(v, deviceSecretKey),
})

export type VoucherCheck = { ok: true } | { ok: false; reason: string }

/**
 * Verificación 100% offline (la usa el tendero sin internet y el gateway al liquidar):
 * certificado firmado por el gateway, vale firmado por el dispositivo, vigencia y tope offline.
 */
export const verifyVoucherOffline = (v: Voucher, gatewayPublicKey: string, now = new Date()): VoucherCheck => {
  const { signature, ...unsigned } = v
  if (!verifyDeviceCert(v.deviceCert, gatewayPublicKey)) return { ok: false, reason: 'Certificado del dispositivo inválido' }
  if (v.deviceCert.deviceKeyId !== v.deviceKeyId) return { ok: false, reason: 'El vale no corresponde al certificado' }
  if (!verifyPayload(unsigned, signature, v.deviceCert.publicKey)) return { ok: false, reason: 'Firma del vale inválida' }
  if (new Date(v.deviceCert.expiresAt) < now) return { ok: false, reason: 'Certificado vencido' }
  const cap = v.deviceCert.offlineCap
  if (v.amount.assetCode !== cap.assetCode) return { ok: false, reason: 'Moneda distinta al tope' }
  if (BigInt(v.amount.value) <= 0n) return { ok: false, reason: 'Monto inválido' }
  if (BigInt(v.cumulative.value) < BigInt(v.amount.value)) return { ok: false, reason: 'Acumulado inconsistente' }
  if (BigInt(v.cumulative.value) > BigInt(cap.value)) return { ok: false, reason: 'Supera el tope offline' }
  return { ok: true }
}

/** Para que el QR sea más corto se serializa en JSON compacto. */
export const encodeVoucher = (v: Voucher) => JSON.stringify(v)
export const decodeVoucher = (s: string): Voucher => JSON.parse(s) as Voucher

export const randomId = (prefix = '') =>
  prefix + toB64(nacl.randomBytes(9)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
