import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../env.ts'
import { gatewayKey } from '../gateway/keys.ts'

// Token de sesión sin estado: `<payload base64url>.<HMAC-SHA256>`. La firma impide que el cliente elija el userId.

const TTL_MS = 7 * 24 * 3600_000

const secret = () => env.SESSION_SECRET || createHash('sha256').update(`paygent-session:${gatewayKey.secretKey}`).digest()
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export const issueToken = (userId: string, now = Date.now()) => {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: now + TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** El userId del token, o undefined si la firma no cuadra o ya venció. */
export const verifyToken = (token: string, now = Date.now()): string | undefined => {
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return undefined
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof sub === 'string' && typeof exp === 'number' && exp > now ? sub : undefined
  } catch {
    return undefined
  }
}
