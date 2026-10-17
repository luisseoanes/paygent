import type { FastifyInstance } from 'fastify'
import { getActiveGrant } from '../db.ts'
import { env } from '../env.ts'
import { refreshFx } from '../fx/trm.ts'
import { findMandate, ROOT_ID } from '../gateway/mandates.ts'
import { getRootAsset } from '../op/asset.ts'
import { seed } from './seed.ts'

export default async function demoRoutes(app: FastifyInstance) {
  /** DEMO-01: deja todo listo en un clic. `{ "full": true }` también borra el grant raíz. */
  app.post<{ Body: { full?: boolean } | undefined }>('/demo/reset', async (req) => {
    await seed({ keepGrant: !req.body?.full })
    return { ok: true, rootGrant: !!(await getActiveGrant(ROOT_ID)), mockOp: env.MOCK_OP }
  })

  /** TRM vigente: { copPerUsd, fecha, fuente: 'trm' | 'respaldo' }. La misma para gateway, web y agentes. */
  app.get('/fx', async () => refreshFx())

  // ?root=<mandato raíz>: el estado de ese titular (su grant y su moneda). Sin root, la demo.
  app.get<{ Querystring: { root?: string } }>('/demo/status', async (req) => {
    const rootId = req.query.root ?? ROOT_ID
    const root = await findMandate(rootId)
    const fx = await refreshFx()
    return {
      mockOp: env.MOCK_OP,
      mockSms: env.MOCK_SMS,
      rootGrant: !!(await getActiveGrant(rootId)),
      fxCopPerUsd: fx.copPerUsd,
      fx,
      asset: root ? { assetCode: root.maxDebit.assetCode, assetScale: root.maxDebit.assetScale } : getRootAsset(),
    }
  })
}
