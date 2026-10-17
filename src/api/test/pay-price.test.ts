import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'

// Open Payments simulado con OTRA tasa que la de referencia (4.000): así cotiza el Test Wallet en la vida real.
const fx = vi.hoisted(() => ({ copPerUsd: 4000 }))
vi.mock('../src/op/settle.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/op/settle.ts')>()
  return {
    ...real,
    settle: async (input: { amount: Amount; price?: Amount; confirmDebit?: (d: Amount) => void | Promise<void> }) => {
      const debit = input.price
        ? { value: String(Math.round((Number(input.price.value) / 100 / fx.copPerUsd) * 100)), assetCode: 'USD', assetScale: 2 }
        : input.amount
      await input.confirmDebit?.(debit) // si lanza, no se paga
      return { outgoingPaymentId: 'op_test', debitAmount: debit, receiveAmount: input.price ?? debit, confirmed: true }
    },
  }
})

const { buildApp } = await import('../src/app.ts')
const store = { ...(await import('../src/store/payments.ts')), ...(await import('../src/store/meta.ts')), ...(await import('../src/store/grants.ts')) }
const { seed, SEED_VERSION } = await import('../src/demo/seed.ts')
const { DEMO_WALLETS } = await import('../src/demo/wallets.ts')
const { getMandate, putMandate } = await import('../src/gateway/mandates.ts')
const { setRootAsset, pesos } = await import('../src/demo/asset.ts')
const { sql } = await import('../src/store/sql.ts')
const { prepareStore } = await import('../src/app.ts')

const app = await buildApp({ logger: false })
const assistantKey = { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }
const USD = { assetCode: 'USD', assetScale: 2 }

// Juan paga en USD (como en el despliegue) y la farmacia cobra en COP.
beforeEach(async () => {
  setRootAsset(USD)
  await seed({ keepGrant: false })
  fx.copPerUsd = 4000
})
const payments = async () => (await sql().query(`select count(*)::int as n from payments`))[0].n

const buy = (pesosPrice: number, extra: object = {}) =>
  app
    .inject({
      method: 'POST',
      url: '/pay',
      headers: assistantKey,
      payload: {
        mandateId: 'asistente',
        merchantWallet: DEMO_WALLETS.farmacia,
        amount: A.fromCop(pesosPrice, USD, 4000), // estimado con la tasa de referencia
        price: A.cop(pesosPrice), // lo que cobra la farmacia
        category: 'farmacia',
        reason: 'losartán',
        ...extra,
      },
    })
    .then((r) => r.json())

describe('Compra en pesos con Juan en dólares', () => {
  // El Test Wallet cambia a ~3.180 COP/USD (medido con `pnpm fx:probe`), no a los 4.000 de referencia.
  beforeEach(() => {
    fx.copPerUsd = 3180
  })

  it('la farmacia recibe sus 12.000 COP y a Juan se le descuenta el débito real ($3.77), no el estimado ($3.00)', async () => {
    const res = await buy(12_000)
    expect(res.result).toBe('allow')
    const p = (await store.getPayment(res.paymentId))!
    expect(p.price).toEqual(A.cop(12_000))
    expect(p.receiveAmount).toEqual(A.cop(12_000))
    expect(p.amount.value).toBe('377')
    expect((await getMandate('asistente')).spentInPeriod.value).toBe('377')
    expect((await getMandate('root')).spentInPeriod.value).toBe('377')
  })

  it('el losartán no pide PIN; la insulina sí (umbral de $10 sobre el débito real)', async () => {
    expect((await buy(12_000)).result).toBe('allow')
    expect((await buy(85_000)).result).toBe('needs_pin')
  })

  it('el PIN se decide con el débito real: 36.000 COP se estiman en $9.00 pero cuestan $11.32', async () => {
    const res = await buy(36_000)
    expect(res.result).toBe('needs_pin')
    expect(await payments()).toBe(0) // no se movió dinero
    const ok = await buy(36_000, { pendingId: res.pendingId, pin: '1234' })
    expect(ok.result).toBe('allow')
    expect((await store.getPayment(ok.paymentId))!.amount.value).toBe('1132')
  })

  it('los topes se validan con el débito real: 150.000 COP se estiman en $37.50 pero cuestan $47.17', async () => {
    const res = await buy(150_000, { pin: '1234' })
    expect(res).toMatchObject({ result: 'deny', reason: 'over_limit' })
    expect((await getMandate('asistente')).spentInPeriod.value).toBe('0')
  })
})

describe('Versión de la semilla', () => {
  it('una base con semilla vieja se vuelve a sembrar al desplegar y conserva el grant de Juan', async () => {
    await sql().query(
      `insert into root_grants (id, root_mandate_id, payer_id, status, wallet_address, max_debit, interval, continue_uri,
         continue_token, access_token, manage_url)
       values ('g1', 'root', 'juan', 'active', 'w', '{}'::jsonb, 'P1M', 'c', 'ct', 't', 'm')`,
    )
    await store.setMeta('seed_version', 'vieja')
    await putMandate({ ...(await getMandate('asistente')), pinThreshold: pesos(8_000) }) // el umbral de $2 que quedó en Railway

    await prepareStore()

    expect(await store.getMeta('seed_version')).toBe(SEED_VERSION)
    expect((await getMandate('asistente')).pinThreshold).toEqual(pesos(40_000))
    expect(await store.getActiveGrant('root')).toEqual({ id: 'g1', walletAddress: 'w', accessToken: 't', manageUrl: 'm', continueUri: 'c', continueToken: 'ct' })
  })
})
