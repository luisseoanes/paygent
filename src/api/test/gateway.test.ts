import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A, generateKeyPair, randomId, signVoucher, type Voucher } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { db } from '../src/db.ts'
import { seed } from '../src/demo/seed.ts'
import { env } from '../src/env.ts'
import { payoutFor } from '../src/gateway/payout.ts'
import { authorize } from '../src/gateway/authorize.ts'
import { delegate, getMandate, restrict, revoke } from '../src/gateway/mandates.ts'
import { verifyMandate } from '@openroute/shared'
import { gatewayKey } from '../src/gateway/keys.ts'

process.env.MOCK_OP = '1'

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

describe('Entrega: recoger o domicilio a la casa que registró Juan', () => {
  const pay = (payload: object) =>
    app.inject({ method: 'POST', url: '/pay', headers: assistantKey, payload }).then((r) => r.json())
  const order = (delivery: object, usd = 4) => ({
    mandateId: 'asistente',
    merchantWallet: db.merchants.farmacia.wallet,
    amount: A.usd(usd),
    category: 'farmacia',
    reason: 'losartán con envío',
    delivery,
  })

  it('el gateway pone la dirección de Juan aunque el agente mande otra', async () => {
    const res = await pay(order({ mode: 'delivery', code: '4321', fee: A.usd(1), address: 'Otra casa', recipientName: 'Ladrón' }))
    expect(res.result).toBe('allow')
    const p = db.payments[res.paymentId]
    expect(p.delivery).toMatchObject({ mode: 'delivery', code: '4321', recipientName: 'María' })
    expect(p.delivery?.address).toMatch(/Vereda La Palma/)
  })

  it('un agente no puede cambiar la dirección; Juan sí', async () => {
    const body = { recipientName: 'Ladrón', address: 'Otra casa' }
    const asAgent = await app.inject({ method: 'PUT', url: '/delivery-address/root', headers: assistantKey, payload: body })
    expect(asAgent.statusCode).toBe(403)
    const asJuan = await app.inject({ method: 'PUT', url: '/delivery-address/root', payload: { recipientName: 'María', address: 'Calle 5 #3-20' } })
    expect(asJuan.statusCode).toBe(200)
    const res = await pay(order({ mode: 'delivery', code: '1111' }))
    expect(db.payments[res.paymentId].delivery?.address).toBe('Calle 5 #3-20')
  })

  it('sin dirección registrada, el domicilio se rechaza y recoger sigue funcionando', async () => {
    db.addresses = {}
    expect(await pay(order({ mode: 'delivery', code: '1111' }))).toMatchObject({ reason: 'no_address' })
    expect((await pay(order({ mode: 'pickup', code: '2222' }))).result).toBe('allow')
  })

  it('con PIN, la entrega se conserva y la tienda ve el pedido', async () => {
    const first = await pay(order({ mode: 'delivery', code: '7777', fee: A.usd(1) }, 22))
    expect(first.result).toBe('needs_pin')
    const ok = await pay({ ...order({ mode: 'pickup', code: 'x' }, 22), pendingId: first.pendingId, pin: '1234' })
    expect(ok.result).toBe('allow')
    const orders = (await app.inject({ method: 'GET', url: '/merchants/farmacia/orders' })).json()
    expect(orders[0]).toMatchObject({ id: ok.paymentId, delivery: { mode: 'delivery', code: '7777', recipientName: 'María' } })
  })
})

describe('Cobro: directo a la wallet del comercio o por Puntored si no tiene', () => {
  const pay = (merchantWallet: string) =>
    app
      .inject({
        method: 'POST',
        url: '/pay',
        headers: assistantKey,
        payload: { mandateId: 'asistente', merchantWallet, amount: A.usd(2), category: 'mercado', reason: 'arroz' },
      })
      .then((r) => r.json())

  it('Doña Rosa (sin wallet) cobra por Puntored; la farmacia (con wallet) directo', async () => {
    expect(payoutFor('puntored:tienda')).toMatchObject({
      destination: env.WALLET_PUNTORED,
      metadata: { payoutVia: 'puntored', comercio: 'tienda', llaveBreB: '3105550101' },
    })
    expect(payoutFor(db.merchants.farmacia.wallet).destination).toBe(db.merchants.farmacia.wallet)

    const res = await pay('puntored:tienda')
    expect(res.result).toBe('allow')
    expect(db.payments[res.paymentId].payout).toEqual({ via: 'puntored', llave: '3105550101' })
    expect(db.feed.at(-1)).toMatchObject({ merchant: 'Tienda Doña Rosa', payout: { via: 'puntored' } })
  })

  it('si el tendero abre una wallet, cobra directo sin cambiar su dirección de cobro', async () => {
    const wallet = 'https://ilp.interledger-test.dev/dona-rosa-nueva'
    const r = await app.inject({ method: 'PUT', url: '/merchants/tienda/payout', payload: { via: 'wallet', wallet } })
    expect(r.statusCode).toBe(200)
    expect(payoutFor('puntored:tienda').destination).toBe(wallet)
    const res = await pay('puntored:tienda')
    expect(db.payments[res.paymentId].payout).toEqual({ via: 'wallet', wallet })
  })

  it('un agente no puede cambiar cómo cobra un comercio; datos inválidos → 400', async () => {
    const asAgent = await app.inject({
      method: 'PUT',
      url: '/merchants/tienda/payout',
      headers: assistantKey,
      payload: { via: 'puntored', llave: '3009999999' },
    })
    expect(asAgent.statusCode).toBe(403)
    const bad = await app.inject({ method: 'PUT', url: '/merchants/tienda/payout', payload: { via: 'puntored', llave: '12' } })
    expect(bad.statusCode).toBe(400)
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
