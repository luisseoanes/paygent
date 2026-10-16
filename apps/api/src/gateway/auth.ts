import type { FastifyRequest } from 'fastify'
import { db, type Agent } from '../db.ts'
import { HttpError } from './errors.ts'

// BE-AUTH (alternativa P0): API key por agente en el header x-api-key.
// TODO BE-AUTH P1: reemplazar por firma ed25519 de la request con la llave registrada del agente.
export const requireAgent = (req: FastifyRequest): Agent => {
  const key = req.headers['x-api-key']
  const agent = Object.values(db.agents).find((a) => a.apiKey === key)
  if (!agent) throw new HttpError(401, 'Agente no autenticado (x-api-key)')
  return agent
}

/** Un agente solo puede gastar con mandatos de los que es titular. */
export const assertHolder = (agent: Agent, mandateId: string) => {
  const m = db.mandates[mandateId]
  if (!m || m.holderId !== agent.id) throw new HttpError(403, `${agent.name} no es titular del mandato ${mandateId}`)
}
