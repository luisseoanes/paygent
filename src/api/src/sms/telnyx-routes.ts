import type { FastifyInstance } from 'fastify'
import { UNAVAILABLE } from './dispatch.ts'
import type { SmsSender } from './sender.ts'
import { parseTelnyxInbound, verifyTelnyxSignature } from './telnyx.ts'

export interface TelnyxRouteDeps {
  publicKey: string
  sender: SmsSender
  reply: (phone: string, text: string) => Promise<string>
  nowS?: () => number
  /** Recibe la respuesta en curso (las pruebas la esperan) */
  track?: (p: Promise<void>) => void
}

// Ids ya atendidos: Telnyx reintenta el webhook y un "PIN 1234" no debe procesarse dos veces.
const SEEN_MAX = 500

/** Webhook de Telnyx: 200 de inmediato; la respuesta sale después por la API de mensajes. */
export default async function telnyxRoutes(app: FastifyInstance, deps: TelnyxRouteDeps) {
  const { publicKey, sender, reply, nowS = () => Math.floor(Date.now() / 1000), track = () => {} } = deps
  const seen = new Set<string>()

  // Cuerpo crudo: la firma cubre los bytes exactos, no el JSON re-serializado.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.post('/sms/telnyx', async (req, res) => {
    const raw = typeof req.body === 'string' ? req.body : ''
    const ok = verifyTelnyxSignature({
      raw,
      signature: req.headers['telnyx-signature-ed25519'] as string | undefined,
      timestamp: req.headers['telnyx-timestamp'] as string | undefined,
      publicKey,
      nowS: nowS(),
    })
    if (!ok) return res.status(403).send({ error: 'firma de Telnyx inválida' })

    let event: unknown
    try {
      event = JSON.parse(raw)
    } catch {
      return res.status(400).send({ error: 'JSON inválido' })
    }
    const msg = parseTelnyxInbound(event)
    if (!msg || (msg.id && seen.has(msg.id))) return { ok: true }
    if (msg.id) {
      seen.add(msg.id)
      if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value!)
    }

    track(
      (async () => {
        let text: string
        try {
          text = await reply(msg.from, msg.text)
        } catch (err) {
          req.log.error(err, '[sms:telnyx] el despacho falló')
          text = UNAVAILABLE
        }
        await sender.send(msg.from, text).catch((err) => req.log.error(err, '[sms:telnyx] no se pudo enviar la respuesta'))
      })(),
    )
    return { ok: true }
  })
}
