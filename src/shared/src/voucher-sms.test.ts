import { describe, expect, it } from 'vitest'
import { cop } from './amount.ts'
import { generateKeyPair, randomId, signDeviceCert, signVoucher, verifyVoucherOffline } from './crypto.ts'
import type { DeviceCert, Voucher } from './types.ts'
import { decodeVoucherSms, encodeVoucherSms, isVoucherSms } from './voucher-sms.ts'

const gateway = generateKeyPair()
const device = generateKeyPair()
const tienda = 'https://ilp.interledger-test.dev/dona-rosa'
const farmacia = 'https://ilp.interledger-test.dev/farmacia-san-jose'

const cert: DeviceCert = signDeviceCert(
  {
    certId: randomId('cert_'),
    deviceKeyId: randomId('dev_'),
    mandateId: 'maria-device',
    publicKey: device.publicKey,
    offlineCap: cop(80_000),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400e3).toISOString(),
  },
  gateway.secretKey,
)

const voucher: Voucher = signVoucher(
  {
    voucherId: randomId('v_'),
    deviceKeyId: cert.deviceKeyId,
    deviceCert: cert,
    merchantWallet: tienda,
    category: 'mercado',
    amount: cop(20_000),
    counter: 3,
    cumulative: cop(52_500),
    createdAt: new Date().toISOString(),
  },
  device.secretKey,
)

const lookup = { cert: (id: string) => (id === cert.certId ? cert : undefined), wallets: [farmacia, tienda] }

describe('vale por SMS', () => {
  it('ida y vuelta: el servidor reconstruye el vale exacto y su firma vale', () => {
    const sms = encodeVoucherSms(voucher)
    const back = decodeVoucherSms(sms, lookup)
    expect(back).toEqual(voucher)
    expect(verifyVoucherOffline(back, gateway.publicKey).ok).toBe(true)
  })

  it('cabe en un solo SMS GSM-7 (≤ 160 caracteres)', () => {
    const sms = encodeVoucherSms(voucher)
    expect(sms.length).toBeLessThanOrEqual(160)
    expect(sms).toMatch(/^VALE [A-Za-z0-9_-]+$/)
  })

  it('reconoce el prefijo sin importar mayúsculas ni espacios', () => {
    expect(isVoucherSms(encodeVoucherSms(voucher))).toBe(true)
    expect(isVoucherSms('  vale abc')).toBe(true)
    expect(isVoucherSms('cuánto me queda?')).toBe(false)
    expect(isVoucherSms('valeria')).toBe(false)
  })

  it('un monto alterado conserva el formato pero la firma falla', () => {
    const tampered = encodeVoucherSms({ ...voucher, amount: cop(70_000), cumulative: cop(70_000) })
    expect(verifyVoucherOffline(decodeVoucherSms(tampered, lookup), gateway.publicKey).ok).toBe(false)
  })

  it('un carácter cambiado en la firma hace fallar la verificación', () => {
    const sms = encodeVoucherSms(voucher)
    const last = sms.at(-2) === 'A' ? 'B' : 'A'
    const tampered = sms.slice(0, -2) + last + sms.at(-1)
    expect(verifyVoucherOffline(decodeVoucherSms(tampered, lookup), gateway.publicKey).ok).toBe(false)
  })

  it('certificado o comercio desconocidos → error legible', () => {
    const sms = encodeVoucherSms(voucher)
    expect(() => decodeVoucherSms(sms, { ...lookup, cert: () => undefined })).toThrow(/Certificado/)
    expect(() => decodeVoucherSms(sms, { ...lookup, wallets: [farmacia] })).toThrow(/Comercio/)
  })

  it('texto basura → error legible', () => {
    expect(() => decodeVoucherSms('VALE hola', lookup)).toThrow(/Vale ilegible/)
    expect(() => decodeVoucherSms('VALE ', lookup)).toThrow(/Vale ilegible/)
    expect(() => decodeVoucherSms(encodeVoucherSms(voucher).slice(0, 60), lookup)).toThrow(/Vale ilegible/)
  })
})
