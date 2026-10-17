import type { FastifyInstance } from 'fastify'
import type { Payout } from '@openroute/shared'
import { requireMerchantOwner, requireSession } from '../auth/guards.ts'
import { getMerchant, listMerchants } from '../store/merchants.ts'
import { ordersFor } from '../store/payments.ts'
import { forbidden, notFound } from '../gateway/errors.ts'
import { registerMerchant, setPayout, type NewMerchant } from './registry.ts'
import { acreditacionesDe } from '../gateway/acreditacion.ts'
import { merchantBody, payoutBody } from '../http/schemas.ts'

export default async function merchantRoutes(app: FastifyInstance) {
  app.get('/merchants', async () => listMerchants())

  // Alta de un comercio: queda a nombre de la cuenta con sesión. Nunca un agente.
  app.post<{ Body: NewMerchant }>('/merchants', { schema: { body: merchantBody } }, async (req, reply) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede dar de alta comercios')
    const merchant = await registerMerchant(req.body ?? {}, requireSession(req))
    reply.status(201)
    return merchant
  })

  // Pedidos del comercio (pagos del Asistente con su modo de entrega): lo que el tendero debe entregar.
  app.get<{ Params: { id: string } }>('/merchants/:id/orders', async (req) => {
    await requireMerchantOwner(req, req.params.id)
    const merchant = await getMerchant(req.params.id)
    if (!merchant) throw notFound('Comercio')
    return ordersFor(merchant.wallet)
  })

  // Lo que Puntored le acreditó a la tienda (si cobra sin wallet). Solo su tendero.
  app.get<{ Params: { id: string } }>('/merchants/:id/credits', async (req) => {
    await requireMerchantOwner(req, req.params.id)
    return acreditacionesDe(req.params.id)
  })

  // Cómo cobra el comercio: lo decide su tendero, nunca un agente.
  app.put<{ Params: { id: string }; Body: Payout }>('/merchants/:id/payout', { schema: { body: payoutBody } }, async (req) => {
    await requireMerchantOwner(req, req.params.id)
    return setPayout(req.params.id, req.body)
  })
}
