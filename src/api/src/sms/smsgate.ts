import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizarCelular } from '../gateway/sms-canal.ts'
import type { SmsSender } from './sender.ts'
import type { InboundSms } from './webhook.ts'

// SMS Gateway for Android (sms-gate.app): un Android con SIM colombiana hace de número, sin cable.
const CLOUD_API = 'https://api.sms-gate.app/3rdparty/v1'
// Ventana anti-replay de la firma (segundos).
const TOLERANCE_S = 300

export interface SmsGateConfig {
  apiUrl: string
  username: string
  password: string
  /** Settings → Webhooks → Signing Key en la app */
  signingKey: string
}

export const loadSmsGateConfig = (e: Record<string, string | undefined>): SmsGateConfig => ({
  apiUrl: e.SMSGATE_API_URL || CLOUD_API,
  username: e.SMSGATE_USERNAME ?? '',
  password: e.SMSGATE_PASSWORD ?? '',
  signingKey: e.SMSGATE_SIGNING_KEY ?? '',
})

interface SignatureInput {
  raw: string
  signature: string | undefined
  timestamp: string | undefined
  key: string
  nowS: number
}

/** La app firma `cuerpo crudo + timestamp` con HMAC-SHA256 (hex); ante cualquier duda se rechaza. */
export const verifySmsGateSignature = ({ raw, signature, timestamp, key, nowS }: SignatureInput): boolean => {
  if (!signature || !timestamp || !key) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return false
  const expected = createHmac('sha256', key).update(raw + timestamp).digest()
  const got = Buffer.from(signature, 'hex')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

interface SmsGateEvent {
  event?: string
  id?: string
  payload?: { messageId?: string; message?: string; sender?: string; phoneNumber?: string }
}

/** Solo sms:received de un celular real: códigos cortos y remitentes con nombre nunca reciben respuesta. */
export const parseSmsGateInbound = (body: unknown): InboundSms | null => {
  const e = body as SmsGateEvent | null
  if (e?.event !== 'sms:received') return null
  const from = normalizarCelular(e.payload?.sender ?? e.payload?.phoneNumber ?? '')
  if (!from) return null
  return { id: e.payload?.messageId ?? e.id ?? '', from, text: (e.payload?.message ?? '').trim() }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

export const smsGateSender = (cfg: Pick<SmsGateConfig, 'apiUrl' | 'username' | 'password'>, fetchFn: Fetch = fetch): SmsSender => ({
  async send(to, text) {
    const res = await fetchFn(`${cfg.apiUrl}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ phoneNumbers: [to], textMessage: { text } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`SMS Gateway respondió ${res.status}: ${await res.text()}`)
  },
})
