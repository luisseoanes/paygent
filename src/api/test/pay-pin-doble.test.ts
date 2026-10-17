import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regresión: confirmar la misma compra pendiente dos veces a la vez (doble toque, reintento del SMS) la pagaba dos
// veces: las dos leían el pendiente antes de que alguna lo borrara. El PIN lento abre esa ventana a propósito.
vi.mock('../src/gateway/pin.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/gateway/pin.ts')>()
  return { ...real, verifyPin: async (...a: Parameters<typeof real.verifyPin>) => (await new Promise((r) => setTimeout(r, 50)), real.verifyPin(...a)) }
})

const { buildApp } = await import('../src/app.ts')
const { pesos } = await import('../src/demo/asset.ts')
const { seed, PIN_DEMO } = await import('../src/demo/seed.ts')
const { DEMO_WALLETS } = await import('../src/demo/wallets.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')
const { asAgent } = await import('./helpers.ts')

const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const body = { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, category: 'farmacia', reason: 'doble', amount: pesos(50_000) }
const pay = (payload: object) => app.inject({ method: 'POST', url: '/pay', headers: asAgent(), payload: { ...body, ...payload } }).then((r) => r.json())

describe('Compra pendiente confirmada dos veces a la vez', () => {
  it('se paga una sola vez', async () => {
    const { pendingId } = await pay({})
    expect(pendingId).toBeTruthy()
    const r = await Promise.all([1, 2, 3].map(() => pay({ pendingId, pin: PIN_DEMO })))
    expect(r.filter((x) => x.result === 'allow')).toHaveLength(1)
    expect((await getMandate('asistente')).spentInPeriod).toEqual(pesos(50_000))
  })
})
