import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A, generateKeyPair, randomId, signVoucher, type Voucher } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { authorize } from '../src/gateway/authorize.ts'
import { delegate, getMandate, restrict, revoke } from '../src/gateway/mandates.ts'
import { verifyMandate } from '@openroute/shared'
import { gatewayKey } from '../src/gateway/keys.ts'

const app = await buildApp({ logger: false })
const assistantKey = { 'x-api-key': 'dev-assistant-key' }
const farmacia = 'https://ilp.interledger-test.dev/farmacia-san-jose'

beforeEach(() => seed({ keepGrant: false }))

describe('GW-02 firma de mandatos', () => {
  it('un mandato alterado falla la verificación', () => {
    const m = getMandate('maria')
    expect(verifyMandate(m, gatewayKey.publicKey)).toBe(true)
    expect(verifyMandate({ ...m, maxDebit: A.usd(9999) }, gatewayKey.publicKey)).toBe(false)
  })
})

describe('GW-03 invariantes de delegación', () => {
  it('suma de hijos ≤ padre', () =>
    expect(() => delegate('root', { holderType: 'person', holderId: 'x', maxDebit: A.usd(20) })).toThrow(/suma/))
  it('categorías ⊆ padre', () =>
    expect(() =>
      delegate('maria-device', { holderType: 'device', holderId: 'x', maxDebit: A.usd(1), categories: ['efectivo'] }),
    ).toThrow(/Categorías/))
  it('vigencia ≤ padre', () =>
    expect(() =>
      delegate('maria', { holderType: 'person', holderId: 'x', maxDebit: A.usd(1), expiresAt: '2999-01-01T00:00:00Z' }),
    ).toThrow(/vigencia/))
})

describe('GW-04 authorize', () => {
  const base = { mandateId: 'asistente', category: 'farmacia' as const }
  it('allow bajo el umbral', () => expect(authorize({ ...base, amount: A.usd(1.5) }).result).toBe('allow'))
  it('needs_pin sobre el umbral', () => expect(authorize({ ...base, amount: A.usd(15) }).result).toBe('needs_pin'))
  it('over_limit', () => expect(authorize({ ...base, amount: A.usd(41), pinOk: true })).toMatchObject({ reason: 'over_limit' }))
  it('category', () => expect(authorize({ ...base, amount: A.usd(1), category: 'efectivo' })).toMatchObject({ reason: 'category' }))
  it('cannot_spend (Guardián)', () =>
    expect(authorize({ ...base, mandateId: 'guardian', amount: A.usd(1) })).toMatchObject({ reason: 'cannot_spend' }))
  it('revoked', () => {
    revoke('asistente')
    expect(authorize({ ...base, amount: A.usd(1) })).toMatchObject({ reason: 'revoked' })
  })
  it('frozen', () => {
    restrict('maria', { frozen: true })
    expect(authorize({ ...base, mandateId: 'maria-device', category: 'mercado', amount: A.usd(1) })).toMatchObject({
      reason: 'frozen',
    })
  })
  it('expired', () =>
    expect(authorize({ ...base, amount: A.usd(1), now: new Date('2999-01-01') })).toMatchObject({ reason: 'expired' }))
})

describe('GW-07/08', () => {
  it('revocar una rama no afecta a sus hermanas', () => {
    revoke('asistente')
    expect(getMandate('asistente-datos').revoked).toBe(true)
    expect(getMandate('maria').revoked).toBe(false)
  })
  it('restrict no puede ampliar más allá del techo de Juan', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/mandates/maria-device/restrict', payload: { offlineCap: A.usd(60) } })
    expect(res.statusCode).toBe(403)
  })
  it('restrict no puede descongelar', () => expect(() => restrict('maria', { frozen: false })).toThrow())
})

describe('/pay', () => {
  it('sin API key → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/pay', payload: {} })
    expect(res.statusCode).toBe(401)
  })
  it('PIN: incorrecto → deny; correcto → pago y gasto en toda la cadena', async () => {
    const pay = (payload: object) =>
      app.inject({ method: 'POST', url: '/pay', headers: assistantKey, payload }).then((r) => r.json())
    const body = { mandateId: 'asistente', merchantWallet: farmacia, amount: A.usd(15), category: 'farmacia', reason: 'losartán' }

    const first = await pay(body)
    expect(first.result).toBe('needs_pin')
    expect(await pay({ ...body, pendingId: first.pendingId, pin: '0000' })).toMatchObject({ reason: 'bad_pin' })
    const ok = await pay({ ...body, pendingId: first.pendingId, pin: '1234' })
    expect(ok.result).toBe('allow')
    expect(getMandate('asistente').spentInPeriod.value).toBe('1500')
    expect(getMandate('root').spentInPeriod.value).toBe('1500')
  })
})

describe('OFF-03 liquidación de vales', () => {
  it('lote de 3: 2 liquidados y 1 replay rechazado + dispositivo congelado', async () => {
    const device = generateKeyPair()
    const reg = await app.inject({ method: 'POST', url: '/mandates/maria-device/device-key', payload: { publicKey: device.publicKey } })
    const { cert } = reg.json()
    const mk = (counter: number, cents: number, cumulative: number): Voucher =>
      signVoucher(
        {
          voucherId: randomId('v_'),
          deviceKeyId: cert.deviceKeyId,
          deviceCert: cert,
          merchantWallet: 'https://ilp.interledger-test.dev/dona-rosa',
          category: 'mercado',
          amount: A.USD(cents),
          counter,
          cumulative: A.USD(cumulative),
          createdAt: new Date().toISOString(),
        },
        device.secretKey,
      )
    const v1 = mk(1, 500, 500)
    const v2 = mk(2, 300, 800)
    const replay = { ...v1 } // el mismo vale, presentado otra vez

    const first = await app.inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers: [v1, v2] } })
    expect(first.json().results.map((r: { status: string }) => r.status)).toEqual(['settled', 'settled'])

    const second = await app.inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers: [replay] } })
    expect(second.json().results[0]).toMatchObject({ status: 'rejected', reason: 'replay' })
    expect(getMandate('maria-device').frozen).toBe(true)
  })
})
