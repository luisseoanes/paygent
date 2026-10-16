import { isVoucherSms } from '@openroute/shared'
import { callAgents } from '../lib/agents.ts'
import { settleVoucherSms } from './vale.ts'

export const UNAVAILABLE = 'El servicio no está disponible. Intente de nuevo en un momento.'

const askAssistant = async (phone: string, text: string, timeoutMs: number) => {
  const res = await callAgents<{ reply: string }>('/assistant/message', { phone, text }, timeoutMs)
  return res?.reply ?? 'El asistente no está disponible. Intente de nuevo en un momento.'
}

/** Despacho único para todo proveedor: un vale se liquida en el gateway (nunca llega al LLM); lo demás va al Asistente. */
export const smsReply = async (phone: string, rawText: string, timeoutMs = 30_000): Promise<string> => {
  const text = rawText.trim()
  return isVoucherSms(text) ? settleVoucherSms(text) : askAssistant(phone, text, timeoutMs)
}
