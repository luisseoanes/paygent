import type { FastifyRequest } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { getAgent, type Agent } from '../db.ts'
import { env } from '../env.ts'
import { findMandate } from './mandates.ts'
import { HttpError } from './errors.ts'

// BE-AUTH: una sola credencial para el servicio de agentes (AGENT_SERVICE_KEY, header x-api-key) y el agente por
// el que actúa en x-agent-id. Los agentes son filas de la tabla agents: dar de alta uno no añade variables de entorno.
const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

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
