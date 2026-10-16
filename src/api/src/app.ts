import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import { isFreshDb } from './db.ts'
import demoRoutes from './demo/routes.ts'
import { seed } from './demo/seed.ts'
import feedRoutes from './feed/routes.ts'
import { HttpError } from './gateway/errors.ts'
import gatewayRoutes from './gateway/routes.ts'
import opRoutes from './op/routes.ts'
import smsRoutes from './sms/routes.ts'
import voucherRoutes from './vouchers/routes.ts'

export const buildApp = async ({ logger = true } = {}) => {
  if (isFreshDb()) seed()

  const app = Fastify({ logger: logger && { transport: undefined, level: 'info' } })
  await app.register(cors, { origin: true })
  await app.register(formbody)

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500)
    if (status >= 500) app.log.error(err)
    reply.status(status).send({ error: err.message })
  })

  app.get('/health', async () => ({ ok: true }))
  await app.register(opRoutes)
  await app.register(gatewayRoutes)
  await app.register(voucherRoutes)
  await app.register(smsRoutes)
  await app.register(feedRoutes)
  await app.register(demoRoutes)
  return app
}
