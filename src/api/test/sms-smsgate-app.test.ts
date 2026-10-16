import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

// La app real con SMS_PROVIDER=smsgate: mismo despacho que /sms/inbound, sin salir a la nube (MOCK_SMS=1).
const KEY = 'llave-de-prueba'
process.env.SMS_PROVIDER = 'smsgate'
process.env.MOCK_SMS = '1'
process.env.SMSGATE_SIGNING_KEY = KEY

const agents = vi.hoisted(() => ({ calls: [] as { path: string; body: unknown }[] }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string, body: unknown) => {
    agents.calls.push({ path, body })
    return path === '/assistant/message' ? { reply: 'respuesta del asistente' } : null
  },
}))

const { buildApp } = await import('../src/app.ts')
const app = await buildApp({ logger: false })

const post = (sender: string, message: string, id: string) => {
  const raw = JSON.stringify({ event: 'sms:received', id, payload: { messageId: id, sender, message } })
  const ts = String(Math.floor(Date.now() / 1000))
  return app.inject({
    method: 'POST',
    url: '/sms/smsgate',
    headers: { 'content-type': 'application/json', 'x-timestamp': ts, 'x-signature': createHmac('sha256', KEY).update(raw + ts).digest('hex') },
    payload: raw,
  })
}
const esperar = () => new Promise((r) => setTimeout(r, 50))

describe('app con SMS_PROVIDER=smsgate', () => {
  it('un celular registrado llega al Asistente (el número sin +57 se normaliza)', async () => {
    agents.calls.length = 0
    expect((await post('3001112233', 'cuánto me queda?', 'a1')).statusCode).toBe(200)
    await esperar()
    expect(agents.calls).toEqual([{ path: '/assistant/message', body: { phone: '+573001112233', text: 'cuánto me queda?' } }])
  })

  it('un SMS personal de un número no registrado no llega al Asistente', async () => {
    agents.calls.length = 0
    expect((await post('3109998877', 'hola, ¿vienes a cenar?', 'a2')).statusCode).toBe(200)
    await esperar()
    expect(agents.calls).toEqual([])
  })

  it('/sms/inbound sigue funcionando para el celular simulado', async () => {
    const res = await app.inject({ method: 'POST', url: '/sms/inbound', payload: { From: '+573001112233', Body: 'hola' } })
    expect(res.json()).toEqual({ reply: 'respuesta del asistente' })
  })
})
