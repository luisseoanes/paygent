import type { FastifyInstance } from 'fastify'
import { db, type PhoneProfile } from '../db.ts'
import { HttpError, badRequest } from '../gateway/errors.ts'
import { chainOf } from '../gateway/mandates.ts'
import { callAgents } from '../lib/agents.ts'

interface PeticionChat {
  mensajes?: { rol: 'usuario' | 'asistente'; texto: string }[]
  contexto?: { mandato?: string }
}

/** El perfil del Asistente de quien chatea: la persona dueña de la rama desde la que escribe (María desde su celular). */
export const perfilDelChat = (mandateId?: string): PhoneProfile | undefined => {
  if (!mandateId || !db.mandates[mandateId]) return undefined
  const rama = new Set(chainOf(mandateId).map((m) => m.id))
  return Object.values(db.phones).find((p) => p.chatFor && rama.has(p.chatFor))
}

/**
 * Chat de la PWA de María con su Asistente (contrato en src/web/ASISTENTE-CHAT.md). Usa el mismo agente que el SMS:
 * propone, pide PIN y paga por /pay con la rama "Asistente de María". El agente guarda su propia sesión, así que
 * basta el último mensaje de la usuaria. Responde JSON { texto } (el chat acepta JSON o streaming).
 */
export default async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: PeticionChat }>('/asistente/chat', async (req) => {
    const texto = req.body?.mensajes?.filter((m) => m.rol === 'usuario').at(-1)?.texto?.trim()
    if (!texto) throw badRequest('Falta el mensaje')
    const perfil = perfilDelChat(req.body?.contexto?.mandato)
    if (!perfil) throw badRequest('Vincula este celular para hablar con tu asistente')
    const res = await callAgents<{ reply: string }>('/assistant/message', { phone: perfil.phone, text: texto }, 30000)
    if (!res) throw new HttpError(503, 'El asistente no está disponible. Intenta de nuevo en un momento.')
    return { texto: res.reply }
  })
}
