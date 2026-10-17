import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A } from '@openroute/shared'

// Regresión: restringir o congelar una rama leía la fila fuera de la transacción y la reescribía entera. Un pago
// reservado entre la lectura y la escritura (otra conexión, en Postgres) se perdía: spentInPeriod volvía atrás.
// PGlite tiene una sola conexión, así que el pago se inyecta justo después de esa lectura sin transacción. Con la
// fila bloqueada no hay lectura fuera de la transacción: el pago espera y corre después, como en Postgres.
let enMedio: (() => Promise<unknown>) | undefined
vi.mock('../src/store/mandates.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/store/mandates.ts')>()
  return {
    ...real,
    findMandate: async (id: string, conn?: unknown) => {
      const m = await real.findMandate(id, conn as never)
      const hook = !conn && id === 'maria-device' ? enMedio : undefined
      enMedio = hook ? undefined : enMedio
      await hook?.()
      return m
    },
  }
})

const { pesos } = await import('../src/demo/asset.ts')
const { seed } = await import('../src/demo/seed.ts')
const { getMandate, restrict, setFrozen } = await import('../src/gateway/mandates.ts')
const { reserveSpend } = await import('../src/gateway/spend.ts')
const { initStore } = await import('../src/store/sql.ts')

await initStore()
beforeEach(async () => {
  enMedio = undefined
  await seed({ keepGrant: false })
})

const reservar = () => reserveSpend({ mandateId: 'maria-device', amount: pesos(1_000), category: 'farmacia', pinOk: true })

describe('Escrituras de un mandato mientras paga', () => {
  it('bajar el tope sin señal no borra un gasto reservado a la vez', async () => {
    const menor = A.percent((await getMandate('maria-device')).offlineCap!, 50)
    enMedio = reservar
    await restrict('maria-device', { offlineCap: menor })
    await enMedio?.()
    const m = await getMandate('maria-device')
    expect(m.offlineCap).toEqual(menor)
    expect(m.spentInPeriod).toEqual(pesos(1_000))
  })

  it('descongelar no borra un gasto reservado a la vez', async () => {
    enMedio = reservar
    await setFrozen('maria-device', false)
    await enMedio?.()
    const m = await getMandate('maria-device')
    expect(m.frozen).toBe(false)
    expect(m.spentInPeriod).toEqual(pesos(1_000))
  })
})
