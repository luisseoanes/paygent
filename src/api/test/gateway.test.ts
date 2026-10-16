import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A, generateKeyPair, randomId, signVoucher, type Voucher } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { getMerchant, getPayment, recentEvents } from '../src/db.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { payoutFor } from '../src/gateway/payout.ts'
import { authorize } from '../src/gateway/authorize.ts'
import { delegate, getMandate, restrict, revoke } from '../src/gateway/mandates.ts'
import { verifyMandate } from '@openroute/shared'
import { gatewayKey } from '../src/gateway/keys.ts'
import { setRootAsset } from '../src/op/asset.ts'
import { sql } from '../src/store/sql.ts'

const app = await buildApp({ logger: false })
const assistantKey = { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }
const farmacia = 'https://ilp.interledger-test.dev/farmacia-san-jose'

beforeEach(() => seed({ keepGrant: false }))

describe('GW-02 firma de mandatos', () => {
  it('un mandato alterado falla la verificación', async () => {
    const m = await getMandate('maria')
    expect(verifyMandate(m, gatewayKey.publicKey)).toBe(true)
    expect(verifyMandate({ ...m, maxDebit: A.cop(39_996_000) }, gatewayKey.publicKey)).toBe(false)
  })
})

describe('GW-03 invariantes de delegación', () => {
  it('suma de hijos ≤ padre', () =>
    expect(delegate('root', { holderType: 'person', holderId: 'x', maxDebit: A.cop(80_000) })).rejects.toThrow(/suma/))
  it('categorías ⊆ padre', () =>
    expect(
      delegate('maria-device', { holderType: 'device', holderId: 'x', maxDebit: A.cop(4000), categories: ['efectivo'] }),
    ).rejects.toThrow(/Categorías/))
  it('vigencia ≤ padre', () =>
    expect(
      delegate('maria', { holderType: 'person', holderId: 'x', maxDebit: A.cop(4000), expiresAt: '2999-01-01T00:00:00Z' }),
    ).rejects.toThrow(/vigencia/))
})

describe('GW-04 authorize', () => {
  const base = { mandateId: 'asistente', category: 'farmacia' as const }
  it('allow bajo el umbral', async () => expect((await authorize({ ...base, amount: A.cop(6000) })).result).toBe('allow'))
  it('needs_pin sobre el umbral', async () => expect((await authorize({ ...base, amount: A.cop(60_000) })).result).toBe('needs_pin'))
  it('over_limit', async () =>
    expect(await authorize({ ...base, amount: A.cop(164_000), pinOk: true })).toMatchObject({ reason: 'over_limit' }))
  it('category', async () =>
    expect(await authorize({ ...base, amount: A.cop(4000), category: 'efectivo' })).toMatchObject({ reason: 'category' }))
  it('cannot_spend (Guardián)', async () =>
    expect(await authorize({ ...base, mandateId: 'guardian', amount: A.cop(4000) })).toMatchObject({ reason: 'cannot_spend' }))
  it('revoked', async () => {
    await revoke('asistente')
    expect(await authorize({ ...base, amount: A.cop(4000) })).toMatchObject({ reason: 'revoked' })
  })
  it('frozen', async () => {
    await restrict('maria', { frozen: true })
    expect(await authorize({ ...base, mandateId: 'maria-device', category: 'mercado', amount: A.cop(4000) })).toMatchObject({
      reason: 'frozen',
    })
  })
  it('expired', async () =>
    expect(await authorize({ ...base, amount: A.cop(4000), now: new Date('2999-01-01') })).toMatchObject({ reason: 'expired' }))
})

describe('GW-07/08', () => {
  it('revocar una rama no afecta a sus hermanas', async () => {
    await revoke('asistente')
    expect((await getMandate('asistente-datos')).revoked).toBe(true)
    expect((await getMandate('maria')).revoked).toBe(false)
  })
  it('restrict no puede ampliar más allá del techo de Juan', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/mandates/maria-device/restrict', payload: { offlineCap: A.cop(240_000) } })
    expect(res.statusCode).toBe(403)
  })
  it('restrict no puede descongelar', () => expect(restrict('maria', { frozen: false })).rejects.toThrow())
})

describe('/pay', () => {
  it('sin credencial del servicio de agentes → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/pay', payload: {} })
    expect(res.statusCode).toBe(401)
  })
  it('PIN: incorrecto → deny; correcto → pago y gasto en toda la cadena', async () => {
    const pay = (payload: object) =>
      app.inject({ method: 'POST', url: '/pay', headers: assistantKey, payload }).then((r) => r.json())
    const body = { mandateId: 'asistente', merchantWallet: farmacia, amount: A.cop(60_000), category: 'farmacia', reason: 'losartán' }

    const first = await pay(body)
    expect(first.result).toBe('needs_pin')
    expect(await pay({ ...body, pendingId: first.pendingId, pin: '0000' })).toMatchObject({ reason: 'bad_pin' })
    const ok = await pay({ ...body, pendingId: first.pendingId, pin: '1234' })
    expect(ok.result).toBe('allow')
    expect((await getMandate('asistente')).spentInPeriod).toEqual(A.cop(60_000))
    expect((await getMandate('root')).spentInPeriod).toEqual(A.cop(60_000))
  })
})

describe('Entrega: recoger o domicilio a la casa que registró Juan', () => {
  const pay = (payload: object) =>
    app.inject({ method: 'POST', url: '/pay', headers: assistantKey, payload }).then((r) => r.json())
  const order = async (delivery: object, pesos = 16_000) => ({
    mandateId: 'asistente',
    merchantWallet: (await getMerchant('farmacia'))!.wallet,
    amount: A.cop(pesos),
    category: 'farmacia',
    reason: 'losartán con envío',
    delivery,
  })

  it('el gateway pone la dirección de Juan aunque el agente mande otra', async () => {
    const res = await pay(await order({ mode: 'delivery', code: '4321', fee: A.cop(4000), address: 'Otra casa', recipientName: 'Ladrón' }))
    expect(res.result).toBe('allow')
    const p = await getPayment(res.paymentId)
    expect(p?.delivery).toMatchObject({ mode: 'delivery', code: '4321', recipientName: 'María' })
    expect(p?.delivery?.address).toMatch(/Vereda La Palma/)
  })

  it('un agente no puede cambiar la dirección; Juan sí', async () => {
    const body = { recipientName: 'Ladrón', address: 'Otra casa' }
    const asAgent = await app.inject({ method: 'PUT', url: '/delivery-address/root', headers: assistantKey, payload: body })
    expect(asAgent.statusCode).toBe(403)
    const asJuan = await app.inject({ method: 'PUT', url: '/delivery-address/root', payload: { recipientName: 'María', address: 'Calle 5 #3-20' } })
    expect(asJuan.statusCode).toBe(200)
    const res = await pay(await order({ mode: 'delivery', code: '1111' }))
    expect((await getPayment(res.paymentId))?.delivery?.address).toBe('Calle 5 #3-20')
  })

  it('sin dirección registrada, el domicilio se rechaza y recoger sigue funcionando', async () => {
    await sql().query(`delete from delivery_addresses`)
    expect(await pay(await order({ mode: 'delivery', code: '1111' }))).toMatchObject({ reason: 'no_address' })
    expect((await pay(await order({ mode: 'pickup', code: '2222' }))).result).toBe('allow')
  })

  it('con PIN, la entrega se conserva y la tienda ve el pedido', async () => {
    const first = await pay(await order({ mode: 'delivery', code: '7777', fee: A.cop(4000) }, 88_000))
    expect(first.result).toBe('needs_pin')
    const ok = await pay({ ...(await order({ mode: 'pickup', code: 'x' }, 88_000)), pendingId: first.pendingId, pin: '1234' })
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
        payload: { mandateId: 'asistente', merchantWallet, amount: A.cop(8000), category: 'mercado', reason: 'arroz' },
      })
      .then((r) => r.json())

  it('Doña Rosa (sin wallet) cobra por Puntored; la farmacia (con wallet) directo', async () => {
    expect(await payoutFor('puntored:tienda')).toMatchObject({
      destination: DEMO_WALLETS.puntored,
      metadata: { payoutVia: 'puntored', comercio: 'tienda', llaveBreB: '3105550101' },
    })
    const wallet = (await getMerchant('farmacia'))!.wallet
    expect((await payoutFor(wallet)).destination).toBe(wallet)

    const res = await pay('puntored:tienda')
    expect(res.result).toBe('allow')
    expect((await getPayment(res.paymentId))?.payout).toEqual({ via: 'puntored', llave: '3105550101' })
    expect((await recentEvents(1))[0]).toMatchObject({ merchant: 'Tienda Doña Rosa', payout: { via: 'puntored' } })
  })

  it('si el tendero abre una wallet, cobra directo sin cambiar su dirección de cobro', async () => {
    const wallet = 'https://ilp.interledger-test.dev/dona-rosa-nueva'
    const r = await app.inject({ method: 'PUT', url: '/merchants/tienda/payout', payload: { via: 'wallet', wallet } })
    expect(r.statusCode).toBe(200)
    expect((await payoutFor('puntored:tienda')).destination).toBe(wallet)
    const res = await pay('puntored:tienda')
    expect((await getPayment(res.paymentId))?.payout).toEqual({ via: 'wallet', wallet })
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
    const mk = (counter: number, pesos: number, cumulative: number): Voucher =>
      signVoucher(
        {
          voucherId: randomId('v_'),
          deviceKeyId: cert.deviceKeyId,
          deviceCert: cert,
          merchantWallet: 'https://ilp.interledger-test.dev/dona-rosa',
          category: 'mercado',
          amount: A.cop(pesos),
          counter,
          cumulative: A.cop(cumulative),
          createdAt: new Date().toISOString(),
        },
        device.secretKey,
      )
    const v1 = mk(1, 20_000, 20_000)
    const v2 = mk(2, 12_000, 32_000)
    const replay = { ...v1 } // el mismo vale, presentado otra vez

    const first = await app.inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers: [v1, v2] } })
    expect(first.json().results.map((r: { status: string }) => r.status)).toEqual(['settled', 'settled'])

    const second = await app.inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers: [replay] } })
    expect(second.json().results[0]).toMatchObject({ status: 'rejected', reason: 'replay' })
    expect((await getMandate('maria-device')).frozen).toBe(true)
  })
})

describe('Moneda raíz: la de la wallet de Juan', () => {
  it('por defecto (mock) Juan paga en COP', async () => {
    expect((await getMandate('root')).maxDebit).toEqual(A.cop(1_200_000))
    const status = (await app.inject({ method: 'GET', url: '/demo/status' })).json()
    expect(status.asset).toEqual({ assetCode: 'COP', assetScale: 2 })
  })

  it('si la wallet de Juan es USD, el árbol se siembra en USD con la tasa de referencia', async () => {
    setRootAsset({ assetCode: 'USD', assetScale: 2 })
    try {
      await seed({ keepGrant: false })
      expect((await getMandate('root')).maxDebit).toEqual(A.usd(300))
      expect((await getMandate('asistente')).pinThreshold).toEqual(A.usd(10))
    } finally {
      setRootAsset(A.COP_ASSET)
    }
  })
})
