import type { FastifyInstance } from 'fastify'
import type { Amount, DeliveryAddress } from '@openroute/shared'
import { requireAgentOrMember, requireMemberOf, requireTitularOf, requireTitularOrGuardian } from '../../auth/guards.ts'
import { getAddress } from '../../store/profiles.ts'
import { addressBody, delegateBody, deviceKeyBody, restrictBody } from '../../http/schemas.ts'
import { delegateBranch, restrictBranch, revokeBranch, setDeliveryAddress, unfreezeBranch } from '../branches.ts'
import { issueDeviceCert } from '../devices.ts'
import { gatewayKey } from '../keys.ts'
import { getMandate, remainingOf, treeOf, type DelegateInput } from '../mandates.ts'

// El árbol de mandatos: lo lee quien está en la cadena (o un agente) y lo cambia su titular.
export default async function mandateRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/mandates/:id', async (req) => {
    await requireAgentOrMember(req, req.params.id)
    return { ...(await getMandate(req.params.id)), remaining: await remainingOf(req.params.id) }
  })

  app.get<{ Params: { id: string } }>('/mandates/:id/tree', async (req) => {
    await requireAgentOrMember(req, req.params.id)
    return treeOf(req.params.id)
  })

  app.post<{ Params: { id: string }; Body: DelegateInput }>('/mandates/:id/delegate', { schema: { body: delegateBody } }, async (req) => {
    await requireTitularOf(req, req.params.id)
    return delegateBranch(req.params.id, req.body)
  })

  app.post<{ Params: { id: string } }>('/mandates/:id/revoke', async (req) => {
    await requireTitularOf(req, req.params.id)
    return { revoked: await revokeBranch(req.params.id) }
  })

  // Solo restringe (monotonía): el titular o el Guardián. Descongelar es solo del titular.
  app.patch<{ Params: { id: string }; Body: { offlineCap?: Amount; frozen?: boolean } }>(
    '/mandates/:id/restrict',
    { schema: { body: restrictBody } },
    async (req) => {
      await requireTitularOrGuardian(req, req.params.id)
      return restrictBranch(req.params.id, req.body ?? {})
    },
  )

  app.post<{ Params: { id: string } }>('/mandates/:id/unfreeze', async (req) => {
    await requireTitularOf(req, req.params.id)
    return unfreezeBranch(req.params.id)
  })

  // El celular de la persona (o su titular) registra su llave y recibe el certificado para pagar sin señal.
  app.post<{ Params: { id: string }; Body: { publicKey: string } }>('/mandates/:id/device-key', { schema: { body: deviceKeyBody } }, async (req) => {
    await requireMemberOf(req, req.params.id)
    const cert = await issueDeviceCert(req.params.id, req.body.publicKey)
    return { deviceKeyId: cert.deviceKeyId, cert, offlineCap: cert.offlineCap, gatewayPublicKey: gatewayKey.publicKey }
  })

  // Dirección de entrega del árbol: la pone el titular en su raíz, nunca un agente.
  app.get<{ Params: { rootId: string } }>('/delivery-address/:rootId', async (req) => {
    await requireAgentOrMember(req, req.params.rootId)
    return getAddress(req.params.rootId)
  })
  app.put<{ Params: { rootId: string }; Body: DeliveryAddress }>('/delivery-address/:rootId', { schema: { body: addressBody } }, async (req) => {
    await requireTitularOf(req, req.params.rootId)
    return setDeliveryAddress(req.params.rootId, req.body ?? {})
  })
}
