import { describe, expect, it } from 'vitest'
import { USD } from './amount.ts'
import { currentPeriodStart } from './interval.ts'
import {
  canonicalize,
  generateKeyPair,
  signDeviceCert,
  signVoucher,
  verifyDeviceCert,
  verifyVoucherOffline,
} from './crypto.ts'

const gateway = generateKeyPair()
const device = generateKeyPair()

const cert = signDeviceCert(
  {
    certId: 'c1',
    deviceKeyId: 'd1',
    mandateId: 'maria-device',
    publicKey: device.publicKey,
    offlineCap: USD(2000),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400e3).toISOString(),
  },
  gateway.secretKey,
)

const voucher = (amountCents: number, cumulativeCents = amountCents) =>
  signVoucher(
    {
      voucherId: 'v1',
      deviceKeyId: 'd1',
      deviceCert: cert,
      merchantWallet: 'https://ilp.example/tienda',
      category: 'mercado',
      amount: USD(amountCents),
      counter: 1,
      cumulative: USD(cumulativeCents),
      createdAt: new Date().toISOString(),
    },
    device.secretKey,
  )

describe('canonicalize', () => {
  it('ordena claves', () => expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}'))
})

describe('vales offline', () => {
  it('certificado válido', () => expect(verifyDeviceCert(cert, gateway.publicKey)).toBe(true))
  it('vale válido', () => expect(verifyVoucherOffline(voucher(500), gateway.publicKey)).toEqual({ ok: true }))
  it('vale alterado falla', () => {
    const v = { ...voucher(500), amount: USD(1999) }
    expect(verifyVoucherOffline(v, gateway.publicKey).ok).toBe(false)
  })
  it('certificado de otro gateway falla', () =>
    expect(verifyVoucherOffline(voucher(500), generateKeyPair().publicKey).ok).toBe(false))
  it('supera el tope offline', () => expect(verifyVoucherOffline(voucher(500, 2500), gateway.publicKey).ok).toBe(false))
})

describe('interval', () => {
  it('ventana de 5 minutos', () => {
    const start = currentPeriodStart('R/2026-01-01T00:00:00Z/PT5M', new Date('2026-01-01T00:12:00Z'))
    expect(start.toISOString()).toBe('2026-01-01T00:10:00.000Z')
  })
  it('ventana mensual', () => {
    const start = currentPeriodStart('R/2026-01-01T00:00:00Z/P1M', new Date('2026-03-15T00:00:00Z'))
    expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })
})
