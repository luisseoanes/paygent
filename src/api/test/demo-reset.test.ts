import { expect, it, vi } from 'vitest'

// El Asistente recuerda conversaciones: tras resembrar la demo no debe arrastrar una charla de antes del reset.
const agents = vi.hoisted(() => ({ calls: [] as string[], down: false }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string) => {
    agents.calls.push(path)
    return agents.down ? null : { ok: true }
  },
}))

const { buildApp } = await import('../src/app.ts')
const { asUser } = await import('./helpers.ts')
const app = await buildApp({ logger: false })

it('el reset de la demo también borra la memoria del Asistente', async () => {
  agents.calls = []
  const res = await app.inject({ method: 'POST', url: '/demo/reset', payload: {}, headers: asUser('juan') })
  expect(res.statusCode).toBe(200)
  expect(agents.calls).toContain('/assistant/reset')
})

it('sin el servicio de agentes el reset igual funciona', async () => {
  agents.down = true
  const res = await app.inject({ method: 'POST', url: '/demo/reset', payload: {}, headers: asUser('juan') })
  expect(res.statusCode).toBe(200)
  expect(res.json()).toMatchObject({ ok: true })
})
