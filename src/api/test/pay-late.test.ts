import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'

// OP-06: Open Payments simulado que tarda más de lo que settle espera. El resultado llega por onLateOutcome.
const late = vi.hoisted(() => ({ outcome: 'completed' as 'completed' | 'failed' | 'timeout', resolve: async (): Promise<void> => {} }))
vi.mock('../src/op/settle.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/op/settle.ts')>()
  return {
    ...real,
    settle: async (input: { amount: Amount; onLateOutcome?: (o: typeof late.outcome) => void | Promise<void> }) => {
      late.resolve = async () => {
        await input.onLateOutcome?.(late.outcome)
      }
      return { outgoingPaymentId: 'op_lento', debitAmount: input.amount, receiveAmount: input.amount, confirmed: false }
    },
  }
})

const { buildApp } = await import('../src/app.ts')
const store = { ...(await import('../src/store/payments.ts')), ...(await import('../src/store/feed.ts')) }
const { seed } = await import('../src/demo/seed.ts')
const { DEMO_WALLETS } = await import('../src/demo/wallets.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')

const app = await buildApp({ logger: false })

beforeEach(() => seed({ keepGrant: false }))

const payInventory = async () =>
  app
    .inject({
      method: 'POST',
      url: '/pay',
      headers: { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' },
      payload: {
        mandateId: 'asistente-datos',
        merchantWallet: DEMO_WALLETS.inventario,
        amount: A.of((await getMandate('asistente-datos')).maxDebit, 0.01),
        category: 'datos',
        reason: 'consulta lenta',
      },
    })
    .then((r) => r.json())

describe('OP-06: pago que tarda más de lo esperado', () => {
  it('queda pending hasta saberse; el Inventario no lo da por cobrado antes de tiempo (INV-03)', async () => {
    const res = await payInventory()
    expect((await store.getPayment(res.paymentId))?.status).toBe('pending')
  })

  it('si al final llega, pasa a completed', async () => {
    late.outcome = 'completed'
    const res = await payInventory()
    await late.resolve()
    expect((await store.getPayment(res.paymentId))?.status).toBe('completed')
  })

  it('si al final falla, pasa a failed y Juan lo ve en el feed', async () => {
    late.outcome = 'failed'
    const res = await payInventory()
    await late.resolve()
    expect((await store.getPayment(res.paymentId))?.status).toBe('failed')
    expect((await store.recentEvents(1))[0]).toMatchObject({ kind: 'denied', reason: 'Pago fallido: no llegó al comercio' })
  })
})
