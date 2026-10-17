import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Amount } from '@openroute/shared'

// Open Payments simulado con token raíz vencido: settle reintenta y vuelve a cotizar (confirmDebit dos veces).
// El gasto debe contarse una sola vez, con la última cotización.
const quotes: Amount[] = []
vi.mock('../src/op/settle.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/op/settle.ts')>()
  return {
    ...real,
    settle: async (input: { amount: Amount; confirmDebit?: (d: Amount) => Promise<void> }) => {
      for (const q of quotes) await input.confirmDebit?.(q)
      const debit = quotes.at(-1)!
      return { outgoingPaymentId: 'op_1', debitAmount: debit, receiveAmount: debit, confirmed: true }
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
beforeEach(async () => {
  quotes.length = 0
  await seed({ keepGrant: false })
})

const pay = (payload: object) =>
  app.inject({ method: 'POST', url: '/pay', headers: asAgent(), payload: { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, category: 'farmacia', reason: 'reintento', ...payload } }).then((r) => r.json())

describe('Reintento por token vencido', () => {
  it('cuenta el gasto una sola vez, con la cotización del reintento', async () => {
    quotes.push(pesos(10_000), pesos(10_200))
    expect(await pay({ amount: pesos(10_000), price: pesos(10_000) })).toMatchObject({ result: 'allow' })
    expect((await getMandate('asistente')).spentInPeriod).toEqual(pesos(10_200))
    expect((await getMandate('root')).spentInPeriod).toEqual(pesos(10_200))
  })
})
