import type { FastifyInstance } from 'fastify'
import { randomId, type Amount, type PayRequest } from '@openroute/shared'
import { db, save } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { revokeRootGrant } from '../op/grants.ts'
import { assertHolder, requireAgent } from './auth.ts'
import { issueDeviceCert } from './devices.ts'
import { notFound } from './errors.ts'
import { gatewayKey } from './keys.ts'
import {
  delegate,
  getMandate,
  remainingOf,
  restrict,
  revoke,
  ROOT_ID,
  setFrozen,
  treeOf,
  type DelegateInput,
} from './mandates.ts'
import { pay } from './pay.ts'

export default async function gatewayRoutes(app: FastifyInstance) {
  app.get('/gateway/public-key', async () => ({ publicKey: gatewayKey.publicKey }))
  app.get('/merchants', async () => Object.values(db.merchants))

  app.get<{ Params: { id: string } }>('/mandates/:id', async (req) => ({
    ...getMandate(req.params.id),
    remaining: remainingOf(req.params.id),
  }))

  app.get<{ Params: { id: string } }>('/mandates/:id/tree', async (req) => treeOf(req.params.id))

  app.post<{ Params: { id: string }; Body: DelegateInput }>('/mandates/:id/delegate', async (req) =>
    delegate(req.params.id, req.body),
  )

  app.post<{ Params: { id: string } }>('/mandates/:id/revoke', async (req) => {
    const m = getMandate(req.params.id)
    if (m.id === ROOT_ID) await revokeRootGrant()
    const revoked = revoke(m.id)
    emit({
      mandateId: m.id,
      actor: { type: 'person', name: 'Juan' },
      kind: 'revoked',
      reason: `Juan revocó la rama de ${m.holderName} (${revoked.length} mandato${revoked.length > 1 ? 's' : ''})`,
    })
    return { revoked }
  })

  app.patch<{ Params: { id: string }; Body: { offlineCap?: Amount; frozen?: boolean } }>(
    '/mandates/:id/restrict',
    async (req) => restrict(req.params.id, req.body ?? {}),
  )

  app.post<{ Params: { id: string } }>('/mandates/:id/unfreeze', async (req) => {
    const m = setFrozen(req.params.id, false)
    emit({ mandateId: m.id, actor: { type: 'person', name: 'Juan' }, kind: 'guardian', reason: `Juan descongeló a ${m.holderName}` })
    return m
  })

  app.post<{ Params: { id: string }; Body: { publicKey: string } }>('/mandates/:id/device-key', async (req) => {
    const cert = issueDeviceCert(req.params.id, req.body.publicKey)
    return { deviceKeyId: cert.deviceKeyId, cert, offlineCap: cert.offlineCap, gatewayPublicKey: gatewayKey.publicKey }
  })

  app.post<{ Body: { name: string; role: 'assistant' | 'inventory' | 'guardian'; walletAddress?: string; publicKey?: string } }>(
    '/agents/register',
    async (req) => {
      const id = randomId('agent_')
      const apiKey = randomId('key_')
      db.agents[id] = { id, apiKey, ...req.body }
      save()
      return { agentId: id, apiKey }
    },
  )

  app.post<{ Body: PayRequest }>('/pay', async (req) => {
    const agent = requireAgent(req)
    assertHolder(agent, req.body.mandateId)
    return pay(req.body)
  })

  app.get<{ Params: { id: string } }>('/payments/:id', async (req) => {
    const p = db.payments[req.params.id]
    if (!p) throw notFound('Pago')
    return p
  })

  // Para que el Asistente sepa quién le escribe y con qué mandatos paga.
  app.get<{ Querystring: { phone: string } }>('/sms/profile', async (req) => {
    const profile = db.phones[req.query.phone]
    if (!profile) throw notFound('Teléfono')
    return profile
  })
}
