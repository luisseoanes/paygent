import type { FastifyInstance } from 'fastify'
import type { Voucher } from '@openroute/shared'
import { requireAgent, requireTitularOrGuardian } from '../auth/guards.ts'
import { listVouchers } from '../store/offline.ts'
import { DEMO_ROOT_ID } from '../demo/constants.ts'
import { vouchersBody } from '../http/schemas.ts'
import { reviewOfflineCaps } from './guardian.ts'
import { settleVouchers } from './settle.ts'

export default async function voucherRoutes(app: FastifyInstance) {
  // Sin sesión a propósito: el tendero liquida al reconectar y cada vale trae su firma y la del certificado.
  app.post<{ Body: { vouchers: Voucher[] } }>('/vouchers/settle', { schema: { body: vouchersBody } }, async (req) => ({
    results: await settleVouchers(req.body.vouchers),
  }))

  app.get('/vouchers', async (req) => {
    await requireAgent(req)
    return listVouchers()
  })

  // GRD-02 a mano. También corre solo cada vez que se liquidan vales de un celular.
  app.post('/guardian/review', async (req) => {
    await requireTitularOrGuardian(req, DEMO_ROOT_ID)
    return { changes: await reviewOfflineCaps() }
  })
}
