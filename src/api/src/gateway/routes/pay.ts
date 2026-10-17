import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { PayRequest } from '@openroute/shared'
import { assertHolder, requireAgent, requireAgentOrMember } from '../../auth/guards.ts'
import type { Agent } from '../../store/agents.ts'
import { getPayment } from '../../store/payments.ts'
import { payBody } from '../../http/schemas.ts'
import { notFound } from '../errors.ts'
import { gatewayKey } from '../keys.ts'
import { pay } from '../pay.ts'

// El único camino del dinero de un agente: propone por aquí y el gateway decide (GW-05/06).
export default async function payRoutes(app: FastifyInstance) {
  app.get('/gateway/public-key', async () => ({ publicKey: gatewayKey.publicKey }))

  // Primero quién llama (antes de validar el cuerpo): sin credencial no se aprende nada del contrato.
  const callers = new WeakMap<FastifyRequest, Agent>()
  const authenticate = async (req: FastifyRequest) => void callers.set(req, await requireAgent(req))
  app.post<{ Body: PayRequest }>('/pay', { schema: { body: payBody }, onRequest: authenticate }, async (req) => {
    await assertHolder(callers.get(req)!, req.body.mandateId)
    return pay(req.body)
  })

  app.get<{ Params: { id: string } }>('/payments/:id', async (req) => {
    const p = await getPayment(req.params.id)
    if (!p) throw notFound('Pago')
    await requireAgentOrMember(req, p.mandateId)
    return p
  })
}
