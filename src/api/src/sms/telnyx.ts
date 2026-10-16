import { createPublicKey, verify } from 'node:crypto'
import { logSender, type SmsSender } from './sender.ts'

const MESSAGES_URL = 'https://api.telnyx.com/v2/messages'
// Ventana anti-replay de la firma (segundos).
const TOLERANCE_S = 300

export interface TelnyxConfig {
  apiKey: string
  /** Llave pública ed25519 del portal (base64, 32 bytes) */
  publicKey: string
  fromNumber: string
  messagingProfileId: string
}

export const loadTelnyxConfig = (e: Record<string, string | undefined>): TelnyxConfig => ({
  apiKey: e.TELNYX_API_KEY ?? '',
  publicKey: e.TELNYX_PUBLIC_KEY ?? '',
  fromNumber: e.TELNYX_FROM_NUMBER ?? '',
  messagingProfileId: e.TELNYX_MESSAGING_PROFILE_ID ?? '',
})

interface SignatureInput {
  raw: string
  signature: string | undefined
  timestamp: string | undefined
  publicKey: string
  nowS: number
}

/** Telnyx firma `${timestamp}|${cuerpo crudo}` con ed25519; ante cualquier duda se rechaza. */
export const verifyTelnyxSignature = ({ raw, signature, timestamp, publicKey, nowS }: SignatureInput): boolean => {
  if (!signature || !timestamp || !publicKey) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return false
  try {
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKey, 'base64').toString('base64url') },
      format: 'jwk',
    })
    return verify(null, Buffer.from(`${timestamp}|${raw}`), key, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

export interface TelnyxInbound {
  id: string
  from: string
  text: string
}

interface TelnyxEvent {
  data?: { event_type?: string; id?: string; payload?: { from?: { phone_number?: string }; text?: string } }
}

/** Solo interesa message.received; los acuses de envío (message.sent, .finalized) se ignoran. */
export const parseTelnyxInbound = (body: unknown): TelnyxInbound | null => {
  const data = (body as TelnyxEvent | null)?.data
  if (data?.event_type !== 'message.received') return null
  const from = data.payload?.from?.phone_number ?? ''
  if (!from) return null
  return { id: data.id ?? '', from, text: (data.payload?.text ?? '').trim() }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

export const telnyxSender = (
  cfg: Pick<TelnyxConfig, 'apiKey' | 'fromNumber' | 'messagingProfileId'>,
  fetchFn: Fetch = fetch,
): SmsSender => ({
  async send(to, text) {
    const body = { from: cfg.fromNumber, to, text, ...(cfg.messagingProfileId && { messaging_profile_id: cfg.messagingProfileId }) }
    const res = await fetchFn(MESSAGES_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Telnyx respondió ${res.status}: ${await res.text()}`)
  },
})

/** MOCK_SMS=1 → solo log; nunca se llama a Telnyx. */
export const selectSmsSender = ({ mock, cfg, fetch: fetchFn, log }: { mock: boolean; cfg: TelnyxConfig; fetch?: Fetch; log?: (m: string) => void }) =>
  mock ? logSender(log) : telnyxSender(cfg, fetchFn)
