import type { FastifyInstance } from 'fastify'
import type { Amount } from '@openroute/shared'
import { requireAgentOrMember, requireTitularOf } from '../../auth/guards.ts'
import { beneficiaryBody, limitsBody, modesBody } from '../../http/schemas.ts'
import { changeLimits, enableBranchModes, registerBeneficiary, splitModes, type NewBeneficiary } from '../branches.ts'
import { listModes } from '../modes.ts'

// Beneficiarios y sus modos de consumo (celular · asistente · sms). Las escrituras son solo del titular.
export default async function beneficiaryRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: NewBeneficiary }>('/mandates/:id/beneficiaries', { schema: { body: beneficiaryBody } }, async (req, reply) => {
    await requireTitularOf(req, req.params.id)
    const created = await registerBeneficiary(req.params.id, req.body ?? {})
    reply.status(201)
    return created
  })

  // Los ve el beneficiario (cómo pagar) y su titular (topes por modo).
  app.get<{ Params: { id: string } }>('/mandates/:id/modes', async (req) => {
    await requireAgentOrMember(req, req.params.id)
    return listModes(req.params.id)
  })

  app.post<{ Params: { id: string } }>('/mandates/:id/modes', async (req) => {
    await requireTitularOf(req, req.params.id)
    return enableBranchModes(req.params.id)
  })

  app.patch<{ Params: { id: string }; Body: { budget?: Amount; limits?: { mandateId: string; maxDebit?: Amount; offlineCap?: Amount }[] } }>(
    '/mandates/:id/modes',
    { schema: { body: modesBody } },
    async (req) => {
      await requireTitularOf(req, req.params.id)
      return splitModes(req.params.id, req.body ?? {})
    },
  )

  // Un agente nunca cambia topes: el Guardián solo restringe (PATCH /mandates/:id/restrict).
  app.patch<{ Params: { id: string }; Body: { maxDebit?: Amount; offlineCap?: Amount } }>('/mandates/:id/limits', { schema: { body: limitsBody } }, async (req) => {
    await requireTitularOf(req, req.params.id)
    return changeLimits(req.params.id, req.body ?? {})
  })
}
