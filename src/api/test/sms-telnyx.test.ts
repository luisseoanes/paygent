import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { loadTelnyxConfig, parseTelnyxInbound, selectSmsSender, telnyxSender, verifyTelnyxSignature } from '../src/sms/telnyx.ts'
import telnyxRoutes from '../src/sms/telnyx-routes.ts'
import type { SmsSender } from '../src/sms/sender.ts'

// Par de llaves local: hace de Telnyx firmando los webhooks.
const keys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url').toString('base64')
  return { publicKey: raw, privateKey }
}
const NOW = 1_760_000_000
const firmar = (privateKey: KeyObject, ts: number, raw: string) =>
  sign(null, Buffer.from(`${ts}|${raw}`), privateKey).toString('base64')

const recibido = (text: string, from = '+573001112233', id = 'msg-1') => ({
  data: { event_type: 'message.received', id, payload: { from: { phone_number: from }, text } },
})

describe('Telnyx: firma del webhook (ed25519)', () => {
  const { publicKey, privateKey } = keys()
  const raw = JSON.stringify(recibido('hola'))

  it('acepta una firma válida y reciente', () => {
    const sig = firmar(privateKey, NOW, raw)
    expect(verifyTelnyxSignature({ raw, signature: sig, timestamp: String(NOW), publicKey, nowS: NOW + 10 })).toBe(true)
  })
  it('rechaza un cuerpo alterado', () => {
    const sig = firmar(privateKey, NOW, raw)
    expect(verifyTelnyxSignature({ raw: raw.replace('hola', 'PIN 1234'), signature: sig, timestamp: String(NOW), publicKey, nowS: NOW })).toBe(false)
  })
  it('rechaza una firma de otra llave', () => {
    const otra = keys()
    const sig = firmar(otra.privateKey, NOW, raw)
    expect(verifyTelnyxSignature({ raw, signature: sig, timestamp: String(NOW), publicKey, nowS: NOW })).toBe(false)
  })
  it('rechaza un timestamp viejo (replay)', () => {
    const sig = firmar(privateKey, NOW, raw)
    expect(verifyTelnyxSignature({ raw, signature: sig, timestamp: String(NOW), publicKey, nowS: NOW + 301 })).toBe(false)
  })
  it('rechaza sin headers, sin llave o con basura', () => {
    expect(verifyTelnyxSignature({ raw, signature: undefined, timestamp: String(NOW), publicKey, nowS: NOW })).toBe(false)
    expect(verifyTelnyxSignature({ raw, signature: 'x', timestamp: undefined, publicKey, nowS: NOW })).toBe(false)
    expect(verifyTelnyxSignature({ raw, signature: firmar(privateKey, NOW, raw), timestamp: String(NOW), publicKey: '', nowS: NOW })).toBe(false)
    expect(verifyTelnyxSignature({ raw, signature: '%%%', timestamp: String(NOW), publicKey, nowS: NOW })).toBe(false)
  })
})

describe('Telnyx: lectura del evento', () => {
  it('message.received → remitente y texto', () => {
    expect(parseTelnyxInbound(recibido(' cuánto me queda? '))).toEqual({ id: 'msg-1', from: '+573001112233', text: 'cuánto me queda?' })
  })
  it('otros eventos (message.sent, message.finalized) → null', () => {
    expect(parseTelnyxInbound({ data: { event_type: 'message.finalized', payload: {} } })).toBeNull()
    expect(parseTelnyxInbound({})).toBeNull()
  })
})

describe('Telnyx: envío por la API de mensajes', () => {
  const cfg = { apiKey: 'k', fromNumber: '+15550001111', messagingProfileId: 'mp-1' }

  it('POST /v2/messages con from, to, text y perfil', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    await telnyxSender(cfg, fetch).send('+573001112233', 'listo')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.telnyx.com/v2/messages')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k')
    expect(JSON.parse(init.body as string)).toEqual({ from: '+15550001111', to: '+573001112233', text: 'listo', messaging_profile_id: 'mp-1' })
  })
  it('sin perfil no manda messaging_profile_id', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    await telnyxSender({ ...cfg, messagingProfileId: '' }, fetch).send('+57300', 'x')
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).not.toHaveProperty('messaging_profile_id')
  })
  it('un error de Telnyx se propaga', async () => {
    const fetch = vi.fn(async () => new Response('{"errors":[]}', { status: 422 }))
    await expect(telnyxSender(cfg, fetch).send('+57300', 'x')).rejects.toThrow(/422/)
  })
})

describe('MOCK_SMS', () => {
  const cfg = { apiKey: 'k', publicKey: 'p', fromNumber: '+1555', messagingProfileId: '' }
  it('con MOCK_SMS=1 nada sale hacia Telnyx', async () => {
    const fetch = vi.fn(async () => new Response('{}'))
    const logs: string[] = []
    await selectSmsSender({ mock: true, cfg, fetch, log: (m) => void logs.push(m) }).send('+57300', 'hola')
    expect(fetch).not.toHaveBeenCalled()
    expect(logs[0]).toContain('hola')
  })
  it('con MOCK_SMS=0 sale por Telnyx', async () => {
    const fetch = vi.fn(async () => new Response('{}'))
    await selectSmsSender({ mock: false, cfg, fetch }).send('+57300', 'hola')
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('Telnyx: configuración', () => {
  it('lee todo del entorno', () => {
    const c = loadTelnyxConfig({ TELNYX_API_KEY: 'k', TELNYX_PUBLIC_KEY: 'p', TELNYX_FROM_NUMBER: '+1555', TELNYX_MESSAGING_PROFILE_ID: 'mp' })
    expect(c).toEqual({ apiKey: 'k', publicKey: 'p', fromNumber: '+1555', messagingProfileId: 'mp' })
  })
})

describe('POST /sms/telnyx', () => {
  const setup = (reply = async (_p: string, t: string) => `eco: ${t}`) => {
    const { publicKey, privateKey } = keys()
    const sent: { to: string; body: string }[] = []
    const sender: SmsSender = { send: async (to, body) => void sent.push({ to, body }) }
    const asked: { phone: string; text: string }[] = []
    let done: Promise<void> = Promise.resolve()
    const app = Fastify()
    app.register(telnyxRoutes, {
      publicKey,
      sender,
      reply: async (phone: string, text: string) => (asked.push({ phone, text }), reply(phone, text)),
      nowS: () => NOW,
      track: (p: Promise<void>) => void (done = p),
    })
    const post = (body: unknown, opts: { sign?: KeyObject; ts?: number } = {}) => {
      const raw = JSON.stringify(body)
      const ts = opts.ts ?? NOW
      return app.inject({
        method: 'POST',
        url: '/sms/telnyx',
        headers: {
          'content-type': 'application/json',
          'telnyx-signature-ed25519': firmar(opts.sign ?? privateKey, ts, raw),
          'telnyx-timestamp': String(ts),
        },
        payload: raw,
      })
    }
    return { app, post, sent, asked, settled: () => done }
  }

  it('responde 200 de inmediato y contesta después por la API de Telnyx', async () => {
    const t = setup()
    const res = await t.post(recibido('cuánto me queda?'))
    expect(res.statusCode).toBe(200)
    await t.settled()
    expect(t.asked).toEqual([{ phone: '+573001112233', text: 'cuánto me queda?' }])
    expect(t.sent).toEqual([{ to: '+573001112233', body: 'eco: cuánto me queda?' }])
  })

  it('firma inválida → 403 y no se atiende', async () => {
    const t = setup()
    const res = await t.post(recibido('PIN 1234'), { sign: keys().privateKey })
    expect(res.statusCode).toBe(403)
    expect(t.asked).toEqual([])
  })

  it('timestamp viejo → 403', async () => {
    const t = setup()
    const res = await t.post(recibido('hola'), { ts: NOW - 3600 })
    expect(res.statusCode).toBe(403)
    expect(t.asked).toEqual([])
  })

  it('eventos que no son message.received → 200 sin responder', async () => {
    const t = setup()
    const res = await t.post({ data: { event_type: 'message.finalized', id: 'x', payload: {} } })
    expect(res.statusCode).toBe(200)
    await t.settled()
    expect(t.asked).toEqual([])
    expect(t.sent).toEqual([])
  })

  it('un reintento de Telnyx (mismo id) no se atiende dos veces', async () => {
    const t = setup()
    await t.post(recibido('PIN 1234', '+573001112233', 'dup'))
    await t.settled()
    const res = await t.post(recibido('PIN 1234', '+573001112233', 'dup'))
    expect(res.statusCode).toBe(200)
    await t.settled()
    expect(t.asked).toHaveLength(1)
  })

  it('si el despacho falla, igual se avisa al usuario', async () => {
    const t = setup(async () => {
      throw new Error('boom')
    })
    await t.post(recibido('hola'))
    await t.settled()
    expect(t.sent).toEqual([{ to: '+573001112233', body: 'El servicio no está disponible. Intente de nuevo en un momento.' }])
  })
})
