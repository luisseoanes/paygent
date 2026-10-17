import { isVoucherSms } from '@openroute/shared'
import type { FastifyInstance } from 'fastify'
import { getProfile } from '../store/profiles.ts'
import { env } from '../env.ts'
import { smsReply } from './dispatch.ts'
import { logSender } from './sender.ts'
import smsGateRoutes from './smsgate-routes.ts'
import { loadSmsGateConfig, smsGateSender } from './smsgate.ts'
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
 * Con SMS_PROVIDER=telnyx o smsgate además existe su webhook firmado con respuesta asíncrona.
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

  if (env.SMS_PROVIDER === 'smsgate') {
    const cfg = loadSmsGateConfig(process.env)
    await app.register(smsGateRoutes, {
      signingKey: cfg.signingKey,
      sender: env.MOCK_SMS ? logSender() : smsGateSender(cfg),
      reply: (phone, text) => smsReply(phone, text, ASYNC_REPLY_TIMEOUT_MS),
      // Solo celulares con canal SMS o vales de un tendero; el resto del SMS personal se ignora.
      accept: async (from, text) => isVoucherSms(text) || Boolean(await getProfile(from)),
    })
  }
}
