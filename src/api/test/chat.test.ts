import { beforeEach, describe, expect, it, vi } from 'vitest'

// El Asistente (src/agents) simulado: registra a quién le habla la api y responde como él.
const agents = vi.hoisted(() => ({ calls: [] as { path: string; body: unknown }[], down: false }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string, body: unknown) => {
    agents.calls.push({ path, body })
    return agents.down ? null : { reply: 'Farmacia San José: Losartán a $12.000. Responda con su PIN para pagar.' }
  },
}))

const { buildApp } = await import('../src/app.ts')
const store = await import('../src/db.ts')
const { seed, CHAT_MARIA, PIN_DEMO } = await import('../src/demo/seed.ts')
const { checkPin } = await import('../src/gateway/pin.ts')
const { pesos } = await import('../src/op/asset.ts')

const app = await buildApp({ logger: false })

beforeEach(() => {
  seed({ keepGrant: false })
  agents.calls = []
  agents.down = false
})

const chat = (payload: object) => app.inject({ method: 'POST', url: '/asistente/chat', payload })

describe('Asistente de María: una hoja de su rama', () => {
  it('cuelga de María con $40 al mes y PIN si pasa de $10', () => {
    const m = store.db.mandates['asistente-maria']
    expect(m).toMatchObject({ parentId: 'maria', holderType: 'agent', holderId: 'asistente' })
    expect(m.maxDebit).toEqual(pesos(160_000))
    expect(m.pinThreshold).toEqual(pesos(40_000))
    expect(store.db.mandates['asistente-maria-datos'].parentId).toBe('asistente-maria')
    expect(checkPin('asistente-maria', PIN_DEMO)).toBe(true)
  })
})

describe('POST /asistente/chat', () => {
  it('María escribe desde su celular y le contesta SU asistente (perfil app:maria)', async () => {
    const res = await chat({
      mensajes: [
        { rol: 'usuario', texto: 'hola' },
        { rol: 'asistente', texto: '¿Qué necesita?' },
        { rol: 'usuario', texto: 'necesito la pastilla de la presión' },
      ],
      contexto: { mandato: 'maria-device' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().texto).toMatch(/PIN/)
    expect(agents.calls).toEqual([
      { path: '/assistant/message', body: { phone: CHAT_MARIA, text: 'necesito la pastilla de la presión' } },
    ])
  })

  it('sin celular vinculado no habla con nadie', async () => {
    const res = await chat({ mensajes: [{ rol: 'usuario', texto: 'hola' }] })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/vincula/i)
    expect(agents.calls).toHaveLength(0)
  })

  it('una rama que no es de María (el Asistente de la mamá) no abre el chat de María', async () => {
    const res = await chat({ mensajes: [{ rol: 'usuario', texto: 'hola' }], contexto: { mandato: 'asistente' } })
    expect(res.statusCode).toBe(400)
  })

  it('si el Asistente no responde, devuelve un error para que el chat ofrezca reintentar', async () => {
    agents.down = true
    const res = await chat({ mensajes: [{ rol: 'usuario', texto: 'hola' }], contexto: { mandato: 'maria-device' } })
    expect(res.statusCode).toBe(503)
  })
})
