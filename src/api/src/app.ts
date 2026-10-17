import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import authRoutes from './auth/routes.ts'
import chatRoutes from './chat/routes.ts'
import demoRoutes from './demo/routes.ts'
import { ensureDemoSeed } from './demo/seed.ts'
import feedRoutes from './feed/routes.ts'
import { HttpError } from './gateway/errors.ts'
import { loadGatewayKey } from './gateway/keys.ts'
import gatewayRoutes from './gateway/routes/index.ts'
import merchantRoutes from './merchants/routes.ts'
import smsRoutes from './sms/routes.ts'
import { initStore } from './store/sql.ts'
import voucherRoutes from './vouchers/routes.ts'

/** Conecta la base (migraciones), carga la llave del gateway y deja la demo sembrada. */
export const prepareStore = async () => {
  await initStore()
  await loadGatewayKey()
  await ensureDemoSeed()
}

export const buildApp = async ({ logger = true } = {}) => {
  await prepareStore()

  const app = Fastify({ logger: logger && { transport: undefined, level: 'info' } })
  await app.register(cors, { origin: true })
  await app.register(formbody)

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500)
    if (status >= 500) app.log.error(err)
    reply.status(status).send({ error: err.message })
  })

  app.get('/health', async () => ({ ok: true }))
  await app.register(gatewayRoutes)
  await app.register(merchantRoutes)
  await app.register(voucherRoutes)
  await app.register(smsRoutes)
  await app.register(chatRoutes)
  await app.register(authRoutes)
  await app.register(feedRoutes)
  await app.register(demoRoutes)
  return app
}
