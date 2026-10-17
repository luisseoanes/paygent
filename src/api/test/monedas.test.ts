import { beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { asAgent, asUser } from './helpers.ts'

// Regresión: un monto en otra escala (COP con escala 0 en un árbol con escala 2) reventaba en A.same con un 500.
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))
const copEscala0 = (value: string) => ({ value, assetCode: 'COP', assetScale: 0 })

describe('Montos en otra moneda o escala', () => {
  it('/pay lo niega con razón legible', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/pay',
      headers: asAgent(),
      payload: { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, amount: copEscala0('5000'), category: 'farmacia', reason: 'x' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ result: 'deny', reason: 'currency' })
  })

  it('alta de beneficiario y delegación → 400', async () => {
    const alta = await app.inject({
      method: 'POST',
      url: '/mandates/root/beneficiaries',
      headers: asUser('juan'),
      payload: { alias: 'Tío', maxDebit: copEscala0('100000'), offlineCap: copEscala0('10000'), pin: '1234' },
    })
    expect(alta.statusCode).toBe(400)
    const rama = await app.inject({
      method: 'POST',
      url: '/mandates/root/delegate',
      headers: asUser('juan'),
      payload: { holderType: 'person', holderId: 'tio', maxDebit: copEscala0('100000') },
    })
    expect(rama.statusCode).toBe(400)
  })

  it('el Guardián con un tope en otra escala → 400', async () => {
    const r = await app.inject({ method: 'PATCH', url: '/mandates/maria-device/restrict', headers: asAgent('guardian'), payload: { offlineCap: copEscala0('1000') } })
    expect(r.statusCode).toBe(400)
  })
})
