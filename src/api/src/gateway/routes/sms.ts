import type { FastifyInstance } from 'fastify'
import { amount as A } from '@openroute/shared'
import { requireAgent, requireTitularOf } from '../../auth/guards.ts'
import { getAddress, getProfile } from '../../store/profiles.ts'
import { smsBody } from '../../http/schemas.ts'
import { turnOffSms, turnOnSms } from '../branches.ts'
import { notFound } from '../errors.ts'
import { getMandate } from '../mandates.ts'
import { estadoSms } from '../sms-canal.ts'

// Canal SMS de una rama: el titular registra el celular y el PIN con los que su beneficiario habla con el Asistente.
export default async function smsChannelRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/mandates/:id/sms', async (req) => {
    await requireTitularOf(req, req.params.id)
    return estadoSms(req.params.id)
  })

  app.put<{ Params: { id: string }; Body: { phone?: string; pin?: string } }>('/mandates/:id/sms', { schema: { body: smsBody } }, async (req) => {
    await requireTitularOf(req, req.params.id)
    return turnOnSms(req.params.id, req.body ?? {})
  })

  app.delete<{ Params: { id: string } }>('/mandates/:id/sms', async (req) => {
    await requireTitularOf(req, req.params.id)
    return turnOffSms(req.params.id)
  })

  // Solo el servicio de agentes: quién escribe, con qué mandatos paga y en qué moneda arma los montos.
  app.get<{ Querystring: { phone: string } }>('/sms/profile', async (req) => {
    await requireAgent(req)
    const profile = await getProfile(req.query.phone)
    if (!profile) throw notFound('Teléfono')
    const root = await getMandate(profile.rootId)
    // Quién delegó: el Asistente lo nombra en vez de suponer un titular fijo.
    return { ...profile, asset: A.assetOf(root.maxDebit), titularName: root.holderName, deliveryAddress: await getAddress(profile.rootId) }
  })
}
