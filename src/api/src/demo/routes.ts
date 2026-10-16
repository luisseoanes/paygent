import type { FastifyInstance } from 'fastify'
import { getActiveGrant } from '../db.ts'
import { env } from '../env.ts'
import { ROOT_ID } from '../gateway/mandates.ts'
import { getRootAsset } from '../op/asset.ts'
import { seed } from './seed.ts'

export default async function demoRoutes(app: FastifyInstance) {
  /** DEMO-01: deja todo listo en un clic. `{ "full": true }` también borra el grant raíz. */
  app.post<{ Body: { full?: boolean } | undefined }>('/demo/reset', async (req) => {
    await seed({ keepGrant: !req.body?.full })
    return { ok: true, rootGrant: !!(await getActiveGrant(ROOT_ID)), mockOp: env.MOCK_OP }
  })

  app.get('/demo/status', async () => ({
    mockOp: env.MOCK_OP,
    mockSms: env.MOCK_SMS,
    rootGrant: !!(await getActiveGrant(ROOT_ID)),
    fxCopPerUsd: env.FX_COP_PER_USD,
    asset: getRootAsset(),
  }))
}
