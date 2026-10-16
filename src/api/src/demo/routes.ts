import type { FastifyInstance } from 'fastify'
import { db } from '../db.ts'
import { env } from '../env.ts'
import { getRootAsset } from '../op/asset.ts'
import { seed } from './seed.ts'

export default async function demoRoutes(app: FastifyInstance) {
  /** DEMO-01: deja todo listo en un clic. `{ "full": true }` también borra el grant raíz. */
  app.post<{ Body: { full?: boolean } | undefined }>('/demo/reset', async (req) => {
    seed({ keepGrant: !req.body?.full })
    return { ok: true, rootGrant: !!db.rootGrant, mockOp: env.MOCK_OP }
  })

  app.get('/demo/status', async () => ({
    mockOp: env.MOCK_OP,
    mockSms: env.MOCK_SMS,
    rootGrant: !!db.rootGrant,
    fxCopPerUsd: env.FX_COP_PER_USD,
    asset: getRootAsset(),
  }))
}
