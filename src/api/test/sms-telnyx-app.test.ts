import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

// La app real con SMS_PROVIDER=telnyx: mismo despacho que /sms/inbound, sin salir a Telnyx (MOCK_SMS=1).
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
process.env.SMS_PROVIDER = 'telnyx'
process.env.MOCK_SMS = '1'
process.env.TELNYX_PUBLIC_KEY = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url').toString('base64')

const agents = vi.hoisted(() => ({ calls: [] as { path: string; body: unknown }[] }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string, body: unknown) => {
    agents.calls.push({ path, body })
    return path === '/assistant/message' ? { reply: 'respuesta del asistente' } : null
  },
}))

const { buildApp } = await import('../src/app.ts')
const app = await buildApp({ logger: false })

const post = (body: unknown, signed = true) => {
  const raw = JSON.stringify(body)
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = sign(null, Buffer.from(`${ts}|${raw}`), privateKey).toString('base64')
  return app.inject({
    method: 'POST',
    url: '/sms/telnyx',
    headers: { 'content-type': 'application/json', 'telnyx-timestamp': ts, ...(signed && { 'telnyx-signature-ed25519': sig }) },
    payload: raw,
  })
}

describe('app con SMS_PROVIDER=telnyx', () => {
  it('sin firma → 403', async () => {
    expect((await post({ data: {} }, false)).statusCode).toBe(403)
  })

  it('un SMS firmado llega al Asistente por el despacho compartido', async () => {
    const res = await post({ data: { event_type: 'message.received', id: 'a1', payload: { from: { phone_number: '+573001112233' }, text: 'hola' } } })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => expect(agents.calls).toEqual([{ path: '/assistant/message', body: { phone: '+573001112233', text: 'hola' } }]))
  })

  it('el JSON de las demás rutas sigue funcionando', async () => {
    const res = await app.inject({ method: 'POST', url: '/sms/inbound', payload: { From: '+573001112233', Body: 'hola' } })
    expect(res.json().reply).toBe('respuesta del asistente')
  })
})
