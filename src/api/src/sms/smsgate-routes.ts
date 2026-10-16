import type { FastifyInstance } from 'fastify'
import type { SmsSender } from './sender.ts'
import { parseSmsGateInbound, verifySmsGateSignature } from './smsgate.ts'
import { asyncSmsWebhook } from './webhook.ts'

export interface SmsGateRouteDeps {
  signingKey: string
  sender: SmsSender
  reply: (phone: string, text: string) => Promise<string>
  /** El celular-puente recibe todo su SMS personal: solo se atiende lo que es de Paygent */
  accept: (from: string, text: string) => Promise<boolean>
  nowS?: () => number
  track?: (p: Promise<void>) => void
}

/** Webhook de SMS Gateway for Android: 200 de inmediato; la respuesta sale por la API de la nube. */
export default async function smsGateRoutes(app: FastifyInstance, deps: SmsGateRouteDeps) {
  const { signingKey, nowS = () => Math.floor(Date.now() / 1000) } = deps
  await asyncSmsWebhook(app, {
    path: '/sms/smsgate',
    rejectStatus: 401,
    verify: (raw, req) =>
      verifySmsGateSignature({
        raw,
        signature: req.headers['x-signature'] as string | undefined,
        timestamp: req.headers['x-timestamp'] as string | undefined,
        key: signingKey,
        nowS: nowS(),
      }),
    parse: parseSmsGateInbound,
    sender: deps.sender,
    reply: deps.reply,
    accept: deps.accept,
    track: deps.track,
  })
}
