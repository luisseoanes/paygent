import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'

// Open Payments simulado con OTRA tasa que la de referencia (4.000): así cotiza el Test Wallet en la vida real.
const fx = vi.hoisted(() => ({ copPerUsd: 4000 }))
vi.mock('../src/op/settle.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/op/settle.ts')>()
  return {
    ...real,
    settle: async (input: { amount: Amount; price?: Amount; confirmDebit?: (d: Amount) => void }) => {
      const debit = input.price
        ? { value: String(Math.round((Number(input.price.value) / 100 / fx.copPerUsd) * 100)), assetCode: 'USD', assetScale: 2 }
        : input.amount
      input.confirmDebit?.(debit) // si lanza, no se paga
      return { outgoingPaymentId: 'op_test', debitAmount: debit, receiveAmount: input.price ?? debit }
    },
  }
})

const { buildApp } = await import('../src/app.ts')
// `db` se reemplaza al sembrar: siempre por el módulo, no desestructurado
const store = await import('../src/db.ts')
const { seed, SEED_VERSION } = await import('../src/demo/seed.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')
const { setRootAsset, pesos } = await import('../src/op/asset.ts')

const app = await buildApp({ logger: false })
const assistantKey = { 'x-api-key': 'dev-assistant-key' }
const USD = { assetCode: 'USD', assetScale: 2 }

// Juan paga en USD (como en el despliegue) y la farmacia cobra en COP.
beforeEach(() => {
  setRootAsset(USD)
  seed({ keepGrant: false })
  fx.copPerUsd = 4000
})

const buy = (pesosPrice: number, extra: object = {}) =>
  app
    .inject({
      method: 'POST',
      url: '/pay',
      headers: assistantKey,
      payload: {
        mandateId: 'asistente',
        merchantWallet: store.db.merchants.farmacia.wallet,
        amount: A.fromCop(pesosPrice, USD, 4000), // estimado con la tasa de referencia
        price: A.cop(pesosPrice), // lo que cobra la farmacia
        category: 'farmacia',
        reason: 'losartán',
        ...extra,
      },
    })
    .then((r) => r.json())

describe('Compra en pesos con Juan en dólares', () => {
  it('la farmacia recibe sus 12.000 COP y a Juan se le descuenta el débito real, no el estimado', async () => {
    fx.copPerUsd = 3800 // el Test Wallet cotiza 12.000 COP = $3.16, no $3.00
    const res = await buy(12_000)
    expect(res.result).toBe('allow')
    const p = store.db.payments[res.paymentId]
    expect(p.price).toEqual(A.cop(12_000))
    expect(p.receiveAmount).toEqual(A.cop(12_000))
    expect(p.amount.value).toBe('316')
    expect(getMandate('asistente').spentInPeriod.value).toBe('316')
    expect(getMandate('root').spentInPeriod.value).toBe('316')
  })

  it('el losartán ($3) no pide PIN: el umbral es $10', async () => {
    expect((await buy(12_000)).result).toBe('allow')
    expect((await buy(85_000)).result).toBe('needs_pin')
  })

  it('si el cambio real se aleja más de 10 % del estimado, no se paga', async () => {
    fx.copPerUsd = 3000 // $4.00 frente a $3.00 estimados
    const res = await buy(12_000)
    expect(res).toMatchObject({ result: 'deny', reason: 'payment_failed' })
    expect(res.detail).toMatch(/cambió más de 10 %/)
    expect(getMandate('asistente').spentInPeriod.value).toBe('0')
  })

  it('con el débito real se vuelven a validar los topes antes de pagar', async () => {
    fx.copPerUsd = 3850 // 156.000 COP: estimado $39.00 (bajo el tope de $40), real $40.52 (lo excede)
    const res = await buy(156_000, { pin: '1234' })
    expect(res).toMatchObject({ result: 'deny', reason: 'payment_failed' })
    expect(getMandate('asistente').spentInPeriod.value).toBe('0')
  })
})

describe('Versión de la semilla', () => {
  it('una base con semilla vieja se vuelve a sembrar al desplegar y conserva el grant de Juan', async () => {
    const grant = { walletAddress: 'w', accessToken: 't', manageUrl: 'm', continueUri: 'c', continueToken: 'ct' }
    store.db.rootGrant = grant
    store.db.seedVersion = 'vieja'
    store.db.mandates.asistente.pinThreshold = pesos(8_000) // el umbral de $2 que quedó en Railway

    await buildApp({ logger: false })

    expect(store.db.seedVersion).toBe(SEED_VERSION)
    expect(store.db.mandates.asistente.pinThreshold).toEqual(pesos(40_000))
    expect(store.db.rootGrant).toEqual(grant)
  })
})
