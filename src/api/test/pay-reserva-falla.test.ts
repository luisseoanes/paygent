import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Amount } from '@openroute/shared'

// Open Payments simulado que falla después de cotizar: lo reservado al autorizar debe volver al tope.
vi.mock('../src/op/settle.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/op/settle.ts')>()
  return {
    ...real,
    settle: async (input: { amount: Amount; confirmDebit?: (d: Amount) => Promise<void> }) => {
      await input.confirmDebit?.(input.amount)
      throw new real.SettleError('El pago no llegó al comercio')
    },
  }
})

const { buildApp } = await import('../src/app.ts')
const { pesos } = await import('../src/demo/asset.ts')
const { seed } = await import('../src/demo/seed.ts')
const { DEMO_WALLETS } = await import('../src/demo/wallets.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')
const { asAgent } = await import('./helpers.ts')

const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const pay = (payload: object) =>
  app.inject({ method: 'POST', url: '/pay', headers: asAgent(), payload: { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, category: 'farmacia', reason: 'falla', ...payload } }).then((r) => r.json())

describe('Un pago que falla devuelve lo reservado', () => {
  it('con el monto en la moneda del titular', async () => {
    expect(await pay({ amount: pesos(10_000) })).toMatchObject({ result: 'deny', reason: 'payment_failed' })
    expect((await getMandate('asistente')).spentInPeriod).toEqual(pesos(0))
    expect((await getMandate('root')).spentInPeriod).toEqual(pesos(0))
  })

  it('con precio en la moneda del comercio (se reserva al cotizar)', async () => {
    expect(await pay({ amount: pesos(10_000), price: pesos(10_000) })).toMatchObject({ result: 'deny', reason: 'payment_failed' })
    expect((await getMandate('asistente')).spentInPeriod).toEqual(pesos(0))
  })
})
