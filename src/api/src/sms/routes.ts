import type { FastifyInstance } from 'fastify'
import { env } from '../env.ts'
import { isVoucherSms } from '@openroute/shared'
import { callAgents } from '../lib/agents.ts'
import { settleVoucherSms } from './vale.ts'

const twiml = (msg: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</Message></Response>`

const askAssistant = async (phone: string, text: string) => {
  const res = await callAgents<{ reply: string }>('/assistant/message', { phone, text }, 30000)
  return res?.reply ?? 'El asistente no está disponible. Intente de nuevo en un momento.'
}

/**
 * SMS-01: Twilio (form-urlencoded) o el celular simulado (JSON) → Agente Asistente → respuesta.
 * TODO AG-05: acuse inmediato "Buscando…" + respuesta final asíncrona por la API REST de Twilio.
 */
export default async function smsRoutes(app: FastifyInstance) {
  app.post<{ Body: { From?: string; Body?: string } }>('/sms/inbound', async (req, reply) => {
    const phone = req.body?.From ?? ''
    const text = (req.body?.Body ?? '').trim()
    // Un vale ("VALE …") se liquida directo en el gateway; jamás llega al Asistente.
    const message = isVoucherSms(text) ? await settleVoucherSms(text) : await askAssistant(phone, text)

    const fromTwilio = req.headers['content-type']?.includes('application/x-www-form-urlencoded')
    if (fromTwilio && !env.MOCK_SMS) return reply.type('text/xml').send(twiml(message))
    return { reply: message }
  })
}
