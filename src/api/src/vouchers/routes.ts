import type { FastifyInstance } from 'fastify'
import type { Voucher } from '@openroute/shared'
import { listVouchers } from '../db.ts'
import { reviewOfflineCaps } from './guardian.ts'
import { settleVouchers } from './settle.ts'

export default async function voucherRoutes(app: FastifyInstance) {
  app.post<{ Body: { vouchers: Voucher[] } }>('/vouchers/settle', async (req) => ({
    results: await settleVouchers(req.body.vouchers ?? []),
  }))

  app.get('/vouchers', async () => listVouchers())

  // GRD-02 a mano (botón "Revisar topes"). También corre solo cada vez que se liquidan vales de un celular.
  app.post('/guardian/review', async () => ({ changes: await reviewOfflineCaps() }))
}
