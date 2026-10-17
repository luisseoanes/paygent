import type { FastifyInstance } from 'fastify'
import agentRoutes from './agents.ts'
import beneficiaryRoutes from './beneficiaries.ts'
import mandateRoutes from './mandates.ts'
import payRoutes from './pay.ts'
import rootGrantRoutes from './root-grant.ts'
import smsChannelRoutes from './sms.ts'

// HTTP del gateway: autentica (auth/guards.ts), valida la forma (http/schemas.ts) y llama al caso de uso.
export default async function gatewayRoutes(app: FastifyInstance) {
  await app.register(rootGrantRoutes)
  await app.register(mandateRoutes)
  await app.register(beneficiaryRoutes)
  await app.register(smsChannelRoutes)
  await app.register(payRoutes)
  await app.register(agentRoutes)
}
