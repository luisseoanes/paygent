import { createHmac } from 'node:crypto'
import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import type { SmsSender } from '../src/sms/sender.ts'
import { loadSmsGateConfig, parseSmsGateInbound, smsGateSender, verifySmsGateSignature } from '../src/sms/smsgate.ts'
import smsGateRoutes from '../src/sms/smsgate-routes.ts'

const KEY = 'llave-de-firma'
const NOW = 1_800_000_000
const firmar = (raw: string, ts = String(NOW), key = KEY) => createHmac('sha256', key).update(raw + ts).digest('hex')

const recibido = (over: Record<string, unknown> = {}) => ({
  deviceId: 'dev1',
  event: 'sms:received',
  id: 'evt1',
  payload: { messageId: 'm1', message: 'cuánto me queda?', sender: '3001112233', recipient: '+573054353220', simNumber: 2, ...over },
  webhookId: 'wh1',
})

describe('verifySmsGateSignature (HMAC-SHA256 de cuerpo + timestamp)', () => {
  const raw = JSON.stringify(recibido())
  const ok = { raw, timestamp: String(NOW), key: KEY, nowS: NOW }

  it('acepta la firma correcta', () => expect(verifySmsGateSignature({ ...ok, signature: firmar(raw) })).toBe(true))
  it('rechaza otra llave', () => expect(verifySmsGateSignature({ ...ok, signature: firmar(raw, String(NOW), 'otra') })).toBe(false))
  it('rechaza un cuerpo alterado', () => expect(verifySmsGateSignature({ ...ok, raw: raw + ' ', signature: firmar(raw) })).toBe(false))
  it('rechaza un timestamp viejo', () =>
    expect(verifySmsGateSignature({ ...ok, timestamp: String(NOW - 600), signature: firmar(raw, String(NOW - 600)) })).toBe(false))
  it('rechaza sin firma o sin llave configurada', () => {
    expect(verifySmsGateSignature({ ...ok, signature: undefined })).toBe(false)
    expect(verifySmsGateSignature({ ...ok, key: '', signature: firmar(raw) })).toBe(false)
  })
})

describe('parseSmsGateInbound', () => {
  it('sms:received → remitente en E.164 y texto', () =>
    expect(parseSmsGateInbound(recibido())).toEqual({ id: 'm1', from: '+573001112233', text: 'cuánto me queda?' }))
  it('versiones viejas mandan phoneNumber en vez de sender', () =>
    expect(parseSmsGateInbound(recibido({ sender: undefined, phoneNumber: '+573001112233' }))?.from).toBe('+573001112233'))
  it('códigos cortos y remitentes alfanuméricos se ignoran (nunca se les responde)', () => {
    expect(parseSmsGateInbound(recibido({ sender: '890806' }))).toBeNull()
    expect(parseSmsGateInbound(recibido({ sender: 'Bancolombia' }))).toBeNull()
  })
  it('otros eventos se ignoran', () => expect(parseSmsGateInbound({ ...recibido(), event: 'sms:sent' })).toBeNull())
})

describe('smsGateSender', () => {
  it('envía por la API de la nube con autenticación básica', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 202 }))
    await smsGateSender({ apiUrl: 'https://api.sms-gate.app/3rdparty/v1', username: 'u', password: 'p' }, fetchFn).send('+573001112233', 'hola')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.sms-gate.app/3rdparty/v1/messages')
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`)
    expect(JSON.parse(init.body as string)).toEqual({ phoneNumbers: ['+573001112233'], textMessage: { text: 'hola' } })
  })
  it('un error del proveedor se propaga', async () => {
    const fetchFn = vi.fn(async () => new Response('no', { status: 401 }))
    await expect(smsGateSender({ apiUrl: 'x', username: 'u', password: 'p' }, fetchFn).send('+57300', 'a')).rejects.toThrow(/401/)
  })
  it('config desde env con la nube por defecto', () =>
    expect(loadSmsGateConfig({ SMSGATE_USERNAME: 'u', SMSGATE_PASSWORD: 'p', SMSGATE_SIGNING_KEY: 'k' })).toEqual({
      apiUrl: 'https://api.sms-gate.app/3rdparty/v1',
      username: 'u',
      password: 'p',
      signingKey: 'k',
    }))
})

describe('POST /sms/smsgate', () => {
  const montar = (accept: (from: string, text: string) => Promise<boolean> = async () => true) => {
    const sent: { to: string; body: string }[] = []
    const sender: SmsSender = { send: async (to, body) => void sent.push({ to, body }) }
    const pending: Promise<void>[] = []
    const reply = vi.fn(async (_phone: string, text: string) => `eco: ${text}`)
    const app = Fastify()
    app.register(smsGateRoutes, { signingKey: KEY, sender, reply, accept, nowS: () => NOW, track: (p) => void pending.push(p) })
    const post = (body: unknown, sig?: string) => {
      const raw = JSON.stringify(body)
      return app.inject({
        method: 'POST',
        url: '/sms/smsgate',
        headers: { 'content-type': 'application/json', 'x-timestamp': String(NOW), 'x-signature': sig ?? firmar(raw) },
        payload: raw,
      })
    }
    return { post, sent, reply, settle: () => Promise.all(pending) }
  }

  it('firma inválida → 401 y nada sale', async () => {
    const t = montar()
    expect((await t.post(recibido(), 'mala')).statusCode).toBe(401)
    expect(t.reply).not.toHaveBeenCalled()
  })

  it('responde 200 de inmediato y la respuesta sale por SMS al remitente', async () => {
    const t = montar()
    expect((await t.post(recibido())).statusCode).toBe(200)
    await t.settle()
    expect(t.sent).toEqual([{ to: '+573001112233', body: 'eco: cuánto me queda?' }])
  })

  it('un remitente no aceptado no se procesa ni se le responde', async () => {
    const t = montar(async () => false)
    expect((await t.post(recibido())).statusCode).toBe(200)
    await t.settle()
    expect(t.reply).not.toHaveBeenCalled()
    expect(t.sent).toEqual([])
  })

  it('el mismo mensaje reintentado se atiende una sola vez', async () => {
    const t = montar()
    await t.post(recibido())
    await t.post(recibido())
    await t.settle()
    expect(t.sent).toHaveLength(1)
  })
})
