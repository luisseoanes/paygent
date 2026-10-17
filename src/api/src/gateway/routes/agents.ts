import type { FastifyInstance } from 'fastify'
import { requireSession } from '../../auth/guards.ts'
import { getAgent, insertAgent, type Agent } from '../../store/agents.ts'
import { agentBody } from '../../http/schemas.ts'
import { isWallet, slug } from '../../merchants/registry.ts'
import { badRequest, forbidden, HttpError } from '../errors.ts'

const ROLES: Agent['role'][] = ['assistant', 'inventory', 'guardian']

// Alta de un agente: una fila más. Gasta con la credencial única del servicio de agentes + su id (x-agent-id).
export default async function agentRoutes(app: FastifyInstance) {
  app.post<{ Body: { id?: string; name?: string; role?: Agent['role']; walletAddress?: string } }>('/agents', { schema: { body: agentBody } }, async (req, reply) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede dar de alta otros agentes')
    requireSession(req)
    const { name, role, walletAddress } = req.body ?? {}
    if (!name?.trim() || !role || !ROLES.includes(role)) throw badRequest('Faltan el nombre o el rol')
    if (walletAddress && !isWallet(walletAddress)) throw badRequest('La wallet debe ser https://…')
    const id = req.body?.id ?? slug(name)
    if (await getAgent(id)) throw new HttpError(409, `Ya existe el agente ${id}`)
    await insertAgent({ id, name: name.trim(), role, walletAddress })
    reply.status(201)
    return getAgent(id)
  })
}
