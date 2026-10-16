import type { FastifyInstance, FastifyRequest } from 'fastify'
import { UNAVAILABLE } from './dispatch.ts'
import type { SmsSender } from './sender.ts'

export interface InboundSms {
  id: string
  from: string
  text: string
}

export interface AsyncWebhookDeps {
  path: string
  /** Firma del proveedor sobre el cuerpo crudo; false → rechazo */
  verify: (raw: string, req: FastifyRequest) => boolean
  rejectStatus: number
  parse: (event: unknown) => InboundSms | null
  sender: SmsSender
  reply: (phone: string, text: string) => Promise<string>
  /** Filtro de privacidad: lo no aceptado ni se procesa ni se registra */
  accept?: (from: string, text: string) => Promise<boolean>
  track?: (p: Promise<void>) => void
}

// Ids ya atendidos: el proveedor reintenta y un "PIN 1234" no debe procesarse dos veces.
const SEEN_MAX = 500

/** Webhook de SMS con respuesta asíncrona: 200 de inmediato; la respuesta sale después por el proveedor. */
export const asyncSmsWebhook = async (app: FastifyInstance, deps: AsyncWebhookDeps) => {
  const { path, verify, rejectStatus, parse, sender, reply, accept = async () => true, track = () => {} } = deps
  const seen = new Set<string>()

  // Cuerpo crudo: la firma cubre los bytes exactos, no el JSON re-serializado.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.post(path, async (req, res) => {
    const raw = typeof req.body === 'string' ? req.body : ''
    if (!verify(raw, req)) return res.status(rejectStatus).send({ error: 'firma inválida' })

    let event: unknown
    try {
      event = JSON.parse(raw)
    } catch {
      return res.status(400).send({ error: 'JSON inválido' })
    }
    const msg = parse(event)
    if (!msg || (msg.id && seen.has(msg.id))) return { ok: true }
    if (msg.id) {
      seen.add(msg.id)
      if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value!)
    }

    track(
      (async () => {
        if (!(await accept(msg.from, msg.text))) return
        let text: string
        try {
          text = await reply(msg.from, msg.text)
        } catch (err) {
          req.log.error(err, `[sms${path}] el despacho falló`)
          text = UNAVAILABLE
        }
        await sender.send(msg.from, text).catch((err) => req.log.error(err, `[sms${path}] no se pudo enviar la respuesta`))
      })(),
    )
    return { ok: true }
  })
}
