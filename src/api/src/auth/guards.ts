import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { findMandate, chainOf } from '../gateway/mandates.ts'
import { forbidden, HttpError } from '../gateway/errors.ts'
import { payerOfRoot } from '../store/accounts.ts'
import { getAgent, type Agent } from '../store/agents.ts'
import { holdersOfChain } from '../store/mandates.ts'
import { merchantOwner } from '../store/merchants.ts'
import { env } from '../env.ts'
import { verifyToken } from './session.ts'

// Quién llama: una persona con sesión (Authorization: Bearer <token>) o el servicio de agentes (x-api-key + x-agent-id).
// Matriz de permisos por ruta en docs/api/endpoints.md.

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

const isAgentCall = (req: FastifyRequest) => req.headers['x-api-key'] !== undefined

/** El token va en Authorization; solo el SSE (EventSource no manda cabeceras) lo pasa en ?token=. */
const tokenOf = (req: FastifyRequest) => {
  const auth = req.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7)
  const q = (req.query as { token?: unknown } | undefined)?.token
  return typeof q === 'string' ? q : undefined
}

export const requireSession = (req: FastifyRequest): string => {
  const token = tokenOf(req)
  const userId = token && verifyToken(token)
  if (!userId) throw new HttpError(401, 'Inicia sesión')
  return userId
}

export const requireAgent = async (req: FastifyRequest): Promise<Agent> => {
  const key = req.headers['x-api-key']
  if (typeof key !== 'string' || !env.AGENT_SERVICE_KEY || !sameSecret(key, env.AGENT_SERVICE_KEY))
    throw new HttpError(401, 'Servicio de agentes no autenticado (x-api-key)')
  const agentId = req.headers['x-agent-id']
  const agent = typeof agentId === 'string' ? await getAgent(agentId) : undefined
  if (!agent) throw new HttpError(401, 'Agente desconocido (x-agent-id)')
  return agent
}

/** Un agente solo puede gastar con mandatos de los que es titular. */
export const assertHolder = async (agent: Agent, mandateId: string) => {
  const m = await findMandate(mandateId)
  if (!m || m.holderId !== agent.id) throw new HttpError(403, `${agent.name} no es titular del mandato ${mandateId}`)
}

/** Solo el titular dueño de la raíz de la rama, nunca un agente. */
export const requireTitularOf = async (req: FastifyRequest, mandateId: string) => {
  if (isAgentCall(req)) throw forbidden('Un agente no puede hacer esto: lo decide el titular')
  const userId = requireSession(req)
  const root = (await chainOf(mandateId)).at(-1)!
  if ((await payerOfRoot(root.id))?.userId !== userId) throw forbidden('Solo el titular de esta cuenta puede cambiar esta rama')
  return userId
}

/** La persona dueña de la rama o de un mandato por encima (su titular). */
export const requireMemberOf = async (req: FastifyRequest, mandateId: string) => {
  if (isAgentCall(req)) throw forbidden('Esto lo hace la persona, no un agente')
  const userId = requireSession(req)
  if (!(await findMandate(mandateId))) throw new HttpError(404, `Mandato ${mandateId} no existe`)
  if (!(await holdersOfChain(mandateId)).includes(userId)) throw forbidden('Esta rama no es tuya')
  return userId
}

/** Lecturas: el servicio de agentes o una persona de la cadena. */
export const requireAgentOrMember = async (req: FastifyRequest, mandateId: string) => {
  if (isAgentCall(req)) await requireAgent(req)
  else await requireMemberOf(req, mandateId)
}

/** Solo restringir: el titular o el Guardián. */
export const requireTitularOrGuardian = async (req: FastifyRequest, mandateId: string) => {
  if (!isAgentCall(req)) return void (await requireTitularOf(req, mandateId))
  const agent = await requireAgent(req)
  if (agent.role !== 'guardian') throw forbidden(`${agent.name} no puede restringir mandatos`)
}

export const requireMerchantOwner = async (req: FastifyRequest, merchantId: string) => {
  if (isAgentCall(req)) throw forbidden('Un agente no puede hacer esto: lo decide el tendero')
  const userId = requireSession(req)
  if ((await merchantOwner(merchantId)) !== userId) throw forbidden('Este comercio no es tuyo')
  return userId
}
