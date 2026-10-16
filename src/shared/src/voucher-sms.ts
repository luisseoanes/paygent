import nacl from 'tweetnacl'
import { fromB64, toB64 } from './crypto.ts'
import { CATEGORIES, type DeviceCert, type Voucher } from './types.ts'

// Vale offline en un solo SMS: "VALE " + base64url de un binario compacto.
// Solo viaja lo que el servidor no conoce: el certificado se busca por certId y el comercio por una huella de su wallet.
// Formato v1: versión(1) · certId(9) · voucherId(9) · huella wallet(4) · categoría(1) · varints(monto, contador, acumulado, createdAt ms) · firma(64)

const PREFIX = 'VALE '
const VERSION = 1
const ID_BYTES = 9 // randomId usa 9 bytes aleatorios → 12 caracteres base64url
const TAG_BYTES = 4
const SIG_BYTES = 64
const CERT_PREFIX = 'cert_'
const VOUCHER_PREFIX = 'v_'

export interface VoucherSmsLookup {
  /** El certificado que el gateway emitió (db.certs) */
  cert: (certId: string) => DeviceCert | undefined
  /** Wallets de cobro conocidas: se elige la que coincide con la huella */
  wallets: string[]
}

const toB64url = (bytes: Uint8Array) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/'))

const walletTag = (wallet: string) => nacl.hash(new TextEncoder().encode(wallet)).slice(0, TAG_BYTES)
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

const idTail = (id: string, prefix: string) => {
  const tail = id.startsWith(prefix) ? id.slice(prefix.length) : ''
  if (!/^[A-Za-z0-9_-]{12}$/.test(tail)) throw new Error(`El vale no se puede comprimir para SMS: id ${id}`)
  return fromB64url(tail)
}

const writeVarint = (out: number[], n: bigint) => {
  if (n < 0n) throw new Error('El vale no se puede comprimir para SMS: número negativo')
  do {
    const byte = Number(n & 0x7fn)
    n >>= 7n
    out.push(n > 0n ? byte | 0x80 : byte)
  } while (n > 0n)
}

/** Lector con límites: cualquier desborde es un vale ilegible. */
const reader = (bytes: Uint8Array) => {
  let pos = 0
  const take = (n: number) => {
    if (pos + n > bytes.length) throw new Error('fin')
    return bytes.slice(pos, (pos += n))
  }
  const varint = () => {
    let n = 0n
    for (let shift = 0n; shift < 70n; shift += 7n) {
      const [b] = take(1)
      n |= BigInt(b! & 0x7f) << shift
      if (!(b! & 0x80)) return n
    }
    throw new Error('varint')
  }
  return { take, varint, rest: () => bytes.length - pos }
}

export const isVoucherSms = (text: string) => /^vale\s/i.test(text.trim())

export const encodeVoucherSms = (v: Voucher): string => {
  const cap = v.deviceCert.offlineCap
  const sameAsset = (a: Voucher['amount']) => a.assetCode === cap.assetCode && a.assetScale === cap.assetScale
  if (!sameAsset(v.amount) || !sameAsset(v.cumulative)) throw new Error('El vale no se puede comprimir para SMS: moneda distinta al tope')
  const ms = new Date(v.createdAt).getTime()
  if (new Date(ms).toISOString() !== v.createdAt) throw new Error('El vale no se puede comprimir para SMS: fecha no ISO')

  const out: number[] = [VERSION]
  out.push(...idTail(v.deviceCert.certId, CERT_PREFIX), ...idTail(v.voucherId, VOUCHER_PREFIX), ...walletTag(v.merchantWallet))
  out.push(CATEGORIES.indexOf(v.category))
  for (const n of [BigInt(v.amount.value), BigInt(v.counter), BigInt(v.cumulative.value), BigInt(ms)]) writeVarint(out, n)
  out.push(...fromB64(v.signature))
  return PREFIX + toB64url(Uint8Array.from(out))
}

/** Rearma el vale completo. No verifica la firma: eso lo hace el mismo camino de liquidación de siempre. */
export const decodeVoucherSms = (text: string, lookup: VoucherSmsLookup): Voucher => {
  let parsed
  try {
    const body = text.trim().replace(/^vale\s+/i, '')
    if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error('alfabeto')
    const r = reader(fromB64url(body))
    if (r.take(1)[0] !== VERSION) throw new Error('versión')
    const certId = CERT_PREFIX + toB64url(r.take(ID_BYTES))
    const voucherId = VOUCHER_PREFIX + toB64url(r.take(ID_BYTES))
    const tag = r.take(TAG_BYTES)
    const category = CATEGORIES[r.take(1)[0]!]
    const [amount, counter, cumulative, ms] = [r.varint(), r.varint(), r.varint(), r.varint()]
    if (!category || r.rest() !== SIG_BYTES) throw new Error('longitud')
    const createdAt = new Date(Number(ms)).toISOString()
    parsed = { certId, voucherId, tag, category, amount, counter: Number(counter), cumulative, createdAt, signature: toB64(r.take(SIG_BYTES)) }
  } catch {
    throw new Error('Vale ilegible: revise que el mensaje llegó completo')
  }

  const cert = lookup.cert(parsed.certId)
  if (!cert) throw new Error('Certificado desconocido')
  const merchantWallet = lookup.wallets.find((w) => sameBytes(walletTag(w), parsed.tag))
  if (!merchantWallet) throw new Error('Comercio desconocido')
  const asset = { assetCode: cert.offlineCap.assetCode, assetScale: cert.offlineCap.assetScale }

  return {
    voucherId: parsed.voucherId,
    deviceKeyId: cert.deviceKeyId,
    deviceCert: cert,
    merchantWallet,
    category: parsed.category,
    amount: { value: String(parsed.amount), ...asset },
    counter: parsed.counter,
    cumulative: { value: String(parsed.cumulative), ...asset },
    createdAt: parsed.createdAt,
    signature: parsed.signature,
  }
}
