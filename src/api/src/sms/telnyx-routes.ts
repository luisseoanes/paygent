import type { FastifyInstance } from 'fastify'
import type { SmsSender } from './sender.ts'
import { parseTelnyxInbound, verifyTelnyxSignature } from './telnyx.ts'
import { asyncSmsWebhook } from './webhook.ts'

export interface TelnyxRouteDeps {
  publicKey: string
  sender: SmsSender
  reply: (phone: string, text: string) => Promise<string>
  nowS?: () => number
  /** Recibe la respuesta en curso (las pruebas la esperan) */
  track?: (p: Promise<void>) => void
}

/** Webhook de Telnyx: 200 de inmediato; la respuesta sale después por la API de mensajes. */
export default async function telnyxRoutes(app: FastifyInstance, deps: TelnyxRouteDeps) {
  const { publicKey, nowS = () => Math.floor(Date.now() / 1000) } = deps
  await asyncSmsWebhook(app, {
    path: '/sms/telnyx',
    rejectStatus: 403,
    verify: (raw, req) =>
      verifyTelnyxSignature({
        raw,
        signature: req.headers['telnyx-signature-ed25519'] as string | undefined,
        timestamp: req.headers['telnyx-timestamp'] as string | undefined,
        publicKey,
        nowS: nowS(),
      }),
    parse: parseTelnyxInbound,
    sender: deps.sender,
    reply: deps.reply,
    track: deps.track,
  })
}
