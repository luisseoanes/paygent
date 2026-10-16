import type { FastifyInstance } from 'fastify'
import { env } from '../env.ts'
import { smsReply } from './dispatch.ts'
import telnyxRoutes from './telnyx-routes.ts'
import { loadTelnyxConfig, selectSmsSender } from './telnyx.ts'

// Con respuesta asíncrona el Asistente tiene más tiempo que el timeout del webhook, con tope.
const ASYNC_REPLY_TIMEOUT_MS = 60_000

const twiml = (msg: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</Message></Response>`

/**
 * SMS-01: TwiML (form-urlencoded), el celular simulado o el puente adb (JSON) → despacho → respuesta.
 * Con SMS_PROVIDER=telnyx además existe POST /sms/telnyx (webhook firmado, respuesta asíncrona).
 */
export default async function smsRoutes(app: FastifyInstance) {
  app.post<{ Body: { From?: string; Body?: string } }>('/sms/inbound', async (req, reply) => {
    const message = await smsReply(req.body?.From ?? '', req.body?.Body ?? '')
    const fromTwilio = req.headers['content-type']?.includes('application/x-www-form-urlencoded')
    if (fromTwilio && !env.MOCK_SMS) return reply.type('text/xml').send(twiml(message))
    return { reply: message }
  })

  if (env.SMS_PROVIDER === 'telnyx') {
    const cfg = loadTelnyxConfig(process.env)
    await app.register(telnyxRoutes, {
      publicKey: cfg.publicKey,
      sender: selectSmsSender({ mock: env.MOCK_SMS, cfg }),
      reply: (phone, text) => smsReply(phone, text, ASYNC_REPLY_TIMEOUT_MS),
    })
  }
}
