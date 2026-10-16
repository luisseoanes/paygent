// Puente SMS: celular real (por un SmsTransport) ↔ POST /sms/inbound. Privacidad primero: solo números permitidos.
import type { SmsSender } from '../sms/sender.ts'

export interface InboundSms {
  id: number
  address: string
}

export interface SmsTransport extends SmsSender {
  latestId(): Promise<number>
  /** Solo id y remitente: el cuerpo se lee aparte y únicamente si el remitente está permitido */
  newMessages(afterId: number): Promise<InboundSms[]>
  readBody(id: number): Promise<string>
}

export interface BridgeDeps {
  transport: SmsTransport
  allow: string[]
  /** Número real → número sembrado en la demo (p. ej. tu celular → '+573001112233') */
  alias: Record<string, string>
  forward: (from: string, body: string) => Promise<string>
  log: (msg: string) => void
}

const UNAVAILABLE = 'El servicio no está disponible. Intente de nuevo en un momento.'

// Un número de celular tiene ≥ 10 dígitos; códigos cortos y remitentes alfanuméricos quedan fuera siempre.
const phoneKey = (address: string) => {
  const clean = address.replace(/[\s()-]/g, '')
  return /^\+?\d{10,15}$/.test(clean) ? clean.replace(/\D/g, '').slice(-10) : null
}

export const createBridge = ({ transport, allow, alias, forward, log }: BridgeDeps) => {
  const allowed = new Set(allow.map(phoneKey).filter(Boolean))
  const aliasByKey = new Map(Object.entries(alias).map(([real, demo]) => [phoneKey(real), demo]))
  const echoes: { key: string; body: string }[] = []
  let lastId = 0

  // Escribirse a sí mismo: la respuesta que mandamos vuelve a la bandeja y no debe reenviarse.
  const isEcho = (key: string, body: string) => {
    const i = echoes.findIndex((e) => e.key === key && e.body === body)
    if (i >= 0) echoes.splice(i, 1)
    return i >= 0
  }

  const handle = async ({ id, address }: InboundSms) => {
    const key = phoneKey(address)
    if (!key || !allowed.has(key)) return log(`#${id} ignorado (remitente no permitido)`)
    const body = (await transport.readBody(id)).trim()
    if (isEcho(key, body)) return log(`#${id} es nuestra propia respuesta: no se reenvía`)

    const from = aliasByKey.get(key) ?? address
    log(`#${id} ${address} → api como ${from}: ${body}`)
    let reply: string
    try {
      reply = await forward(from, body)
    } catch (err) {
      log(`#${id} la api falló: ${(err as Error).message}`)
      reply = UNAVAILABLE
    }
    await transport.send(address, reply)
    echoes.push({ key, body: reply.trim() })
    log(`#${id} respuesta enviada: ${reply}`)
  }

  return {
    async start() {
      lastId = await transport.latestId()
      log(`escuchando mensajes nuevos (último id ${lastId})`)
    },
    async tick() {
      const msgs = (await transport.newMessages(lastId)).sort((a, b) => a.id - b.id)
      for (const m of msgs) {
        lastId = Math.max(lastId, m.id)
        await handle(m)
      }
    },
  }
}
