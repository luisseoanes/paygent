import type { FastifyInstance } from 'fastify'
import type { PayRequest } from '@openroute/shared'
import { assertHolder, requireAgent, requireAgentOrMember } from '../../auth/guards.ts'
import { getPayment } from '../../store/payments.ts'
import { payBody } from '../../http/schemas.ts'
import { notFound } from '../errors.ts'
import { gatewayKey } from '../keys.ts'
import { pay } from '../pay.ts'

// El único camino del dinero de un agente: propone por aquí y el gateway decide (GW-05/06).
export default async function payRoutes(app: FastifyInstance) {
  app.get('/gateway/public-key', async () => ({ publicKey: gatewayKey.publicKey }))

  // Primero quién llama (antes de validar el cuerpo): sin credencial no se aprende nada del contrato.
  app.post<{ Body: PayRequest }>('/pay', { schema: { body: payBody }, onRequest: async (req) => void (await requireAgent(req)) }, async (req) => {
    const agent = await requireAgent(req)
    await assertHolder(agent, req.body.mandateId)
    return pay(req.body)
  })

  app.get<{ Params: { id: string } }>('/payments/:id', async (req) => {
    const p = await getPayment(req.params.id)
    if (!p) throw notFound('Pago')
    await requireAgentOrMember(req, p.mandateId)
    return p
  })
}
