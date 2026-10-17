import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { pesos } from '../src/demo/asset.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { getMandate } from '../src/gateway/mandates.ts'
import { asAgent } from './helpers.ts'

// Dos pagos a la vez en la misma rama no pueden leer el mismo «disponible»: el gasto se reserva al autorizar,
// bajo bloqueo, antes de mover el dinero (Open Payments simulado tarda 250 ms en liquidar).
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const pay = (pesosCop: number) =>
  app
    .inject({
      method: 'POST',
      url: '/pay',
      headers: asAgent(),
      payload: { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, amount: pesos(pesosCop), category: 'farmacia', reason: 'a la vez' },
    })
    .then((r) => r.json())

describe('Pagos simultáneos en la misma rama', () => {
  it('cinco pagos de 39.000 contra un tope de 160.000: pasan 4 y el gasto nunca supera el tope', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => pay(39_000)))
    expect(results.filter((r) => r.result === 'allow')).toHaveLength(4)
    expect(results.filter((r) => r.reason === 'over_limit')).toHaveLength(1)
    const m = await getMandate('asistente')
    expect(m.spentInPeriod).toEqual(pesos(156_000))
    expect(A.lte(m.spentInPeriod, m.maxDebit)).toBe(true)
  })
})
