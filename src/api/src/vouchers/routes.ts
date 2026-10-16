import type { FastifyInstance } from 'fastify'
import { amount as A, type Amount, type Voucher } from '@openroute/shared'
import { listVouchers, vouchersOfMandate } from '../db.ts'
import { emit } from '../feed/bus.ts'
import { offlineDevices, restrict } from '../gateway/mandates.ts'
import { callAgents } from '../lib/agents.ts'
import { settleVouchers } from './settle.ts'

export default async function voucherRoutes(app: FastifyInstance) {
  app.post<{ Body: { vouchers: Voucher[] } }>('/vouchers/settle', async (req) => ({
    results: await settleVouchers(req.body.vouchers ?? []),
  }))

  app.get('/vouchers', async () => listVouchers())

  /**
   * GRD-02: el Guardián recalcula el tope offline de cada dispositivo según su historial.
   * Siempre acotado por lo que Juan autorizó (offlineCapCeiling) vía restrict().
   */
  app.post('/guardian/review', async () => {
    const devices = await offlineDevices()
    const changes = []
    for (const m of devices) {
      const history = (await vouchersOfMandate(m.id)).map((s) => ({ ...s.voucher, status: s.status }))
      const res = await callAgents<{ newCap: Amount; explanation: string }>('/guardian/score', {
        mandateId: m.id,
        holderName: m.holderName,
        offlineCap: m.offlineCap,
        ceiling: m.offlineCapCeiling ?? m.offlineCap,
        frozen: m.frozen,
        history,
      })
      if (!res || A.cmp(res.newCap, m.offlineCap!) === 0) continue
      try {
        const updated = await restrict(m.id, { offlineCap: res.newCap })
        await emit({ mandateId: m.id, actor: { type: 'agent', name: 'Guardián' }, kind: 'guardian', amount: res.newCap, reason: res.explanation })
        changes.push({ mandateId: m.id, from: m.offlineCap, to: updated.offlineCap })
      } catch (err) {
        changes.push({ mandateId: m.id, error: (err as Error).message })
      }
    }
    return { changes }
  })
}
