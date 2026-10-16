import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import authRoutes from './auth/routes.ts'
import chatRoutes from './chat/routes.ts'
import { getMeta, payerOfRoot } from './db.ts'
import demoRoutes from './demo/routes.ts'
import { seed, SEED_VERSION } from './demo/seed.ts'
import feedRoutes from './feed/routes.ts'
import { HttpError } from './gateway/errors.ts'
import { loadGatewayKey } from './gateway/keys.ts'
import { findMandate, ROOT_ID } from './gateway/mandates.ts'
import gatewayRoutes from './gateway/routes.ts'
import { resolveRootAsset } from './op/asset.ts'
import opRoutes from './op/routes.ts'
import smsRoutes from './sms/routes.ts'
import { importLegacyGrant } from './store/legacy.ts'
import { initStore } from './store/sql.ts'
import voucherRoutes from './vouchers/routes.ts'

/** Conecta la base (migraciones), carga la llave del gateway y deja la demo sembrada. */
export const prepareStore = async () => {
  await initStore()
  await loadGatewayKey()
  const asset = await resolveRootAsset((await payerOfRoot(ROOT_ID))?.walletAddress)
  const root = await findMandate(ROOT_ID)
  if (!root) {
    await importLegacyGrant(ROOT_ID)
    await seed()
  } else if (root.maxDebit.assetCode !== asset.assetCode || root.maxDebit.assetScale !== asset.assetScale) {
    // Si Juan cambió de moneda, el árbol y el grant guardados ya no sirven.
    await seed({ keepGrant: false })
  } else {
    const stored = await getMeta('seed_version')
    if (stored !== SEED_VERSION) {
      console.log(`[seed] semilla ${stored ?? 'sin versión'} → ${SEED_VERSION}: se vuelve a sembrar (el grant de Juan se conserva)`)
      await seed({ keepGrant: true })
    }
  }
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
  await app.register(opRoutes)
  await app.register(gatewayRoutes)
  await app.register(voucherRoutes)
  await app.register(smsRoutes)
  await app.register(chatRoutes)
  await app.register(authRoutes)
  await app.register(feedRoutes)
  await app.register(demoRoutes)
  return app
}
