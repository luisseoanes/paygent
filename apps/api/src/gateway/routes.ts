import type { FastifyInstance } from 'fastify'
import { randomId, type Amount, type DeliveryAddress, type PayRequest, type Payout } from '@openroute/shared'
import { db, save } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { revokeRootGrant } from '../op/grants.ts'
import { assertHolder, requireAgent } from './auth.ts'
import { issueDeviceCert } from './devices.ts'
import { badRequest, forbidden, notFound } from './errors.ts'
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
import { describePayout } from './payout.ts'

export default async function gatewayRoutes(app: FastifyInstance) {
  app.get('/gateway/public-key', async () => ({ publicKey: gatewayKey.publicKey }))
  app.get('/merchants', async () => Object.values(db.merchants))

  // Pedidos de un comercio (pagos del Asistente con su modo de entrega): lo que el tendero debe entregar.
  app.get<{ Params: { id: string } }>('/merchants/:id/orders', async (req) => {
    const merchant = db.merchants[req.params.id]
    if (!merchant) throw notFound('Comercio')
    return Object.values(db.payments)
      .filter((p) => p.merchantWallet === merchant.wallet && p.delivery && p.status === 'completed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  // Cómo cobra el comercio: directo a su wallet o por Puntored a su llave Bre-B. Lo decide el tendero,
  // nunca un agente. Su dirección de cobro no cambia, así que los vales que ya recibió siguen valiendo.
  app.put<{ Params: { id: string }; Body: Payout }>('/merchants/:id/payout', async (req) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede cambiar cómo cobra un comercio')
    const merchant = db.merchants[req.params.id]
    if (!merchant || merchant.isAgent) throw notFound('Comercio')
    const body = req.body
    if (body?.via === 'wallet' && /^https:\/\/\S+$/.test(body.wallet ?? '')) merchant.payout = { via: 'wallet', wallet: body.wallet }
    else if (body?.via === 'puntored' && /^\d{10}$/.test(body.llave ?? '')) merchant.payout = { via: 'puntored', llave: body.llave }
    else throw badRequest('Use { via: "wallet", wallet: "https://…" } o { via: "puntored", llave: "<celular de 10 dígitos>" }')
    save()
    emit({
      mandateId: ROOT_ID,
      actor: { type: 'person', name: merchant.name },
      kind: 'grant',
      reason: `${merchant.name} ahora cobra ${describePayout(merchant.payout)}`,
    })
    return merchant
  })

  // Dirección de entrega del mandato raíz. La pone Juan (o quien aprobó la raíz), nunca un agente.
  app.get<{ Params: { rootId: string } }>('/delivery-address/:rootId', async (req) => db.addresses[req.params.rootId] ?? null)
  app.put<{ Params: { rootId: string }; Body: DeliveryAddress }>('/delivery-address/:rootId', async (req) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede cambiar la dirección de entrega')
    const root = getMandate(req.params.rootId)
    if (root.parentId) throw badRequest('La dirección se registra en el mandato raíz')
    const recipientName = req.body?.recipientName?.trim()
    const address = req.body?.address?.trim()
    if (!recipientName || !address) throw badRequest('Faltan el nombre de quien recibe o la dirección')
    db.addresses[root.id] = { recipientName, address }
    save()
    emit({
      mandateId: root.id,
      actor: { type: 'person', name: root.holderName },
      kind: 'grant',
      reason: `Dirección de entrega: casa de ${recipientName}, ${address}`,
    })
    return db.addresses[root.id]
  })

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
    return { ...profile, deliveryAddress: db.addresses[profile.rootId] ?? null }
  })
}
