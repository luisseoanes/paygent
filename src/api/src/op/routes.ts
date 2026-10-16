import type { FastifyInstance } from 'fastify'
import { amount as A, monthly, type Amount } from '@openroute/shared'
import { getActiveGrant, payerOfRoot } from '../db.ts'
import { env } from '../env.ts'
import { emit } from '../feed/bus.ts'
import { badRequest } from '../gateway/errors.ts'
import { getMandate, putMandate, ROOT_ID } from '../gateway/mandates.ts'
import { getWallet } from './client.ts'
import { continueRootGrant, requestRootGrant } from './grants.ts'

export default async function opRoutes(app: FastifyInstance) {
  // OP-01
  app.get('/health/op', async () => {
    const rootGrant = !!(await getActiveGrant(ROOT_ID))
    if (env.MOCK_OP) return { mock: true, rootGrant }
    const payer = await payerOfRoot(ROOT_ID)
    return { mock: false, rootGrant, juan: payer ? await getWallet(payer.walletAddress) : null }
  })

  // OP-02
  app.post<{ Body: { walletAddress?: string; maxDebit?: Amount; interval?: string } }>('/mandates/root', async (req) => {
    const body = req.body ?? {}
    // La wallet es la de quien delega (tabla payers); el cuerpo puede indicarla, pero no hace falta.
    const walletAddress = body.walletAddress ?? (await payerOfRoot(ROOT_ID))?.walletAddress
    if (!walletAddress) throw badRequest('No hay una wallet registrada para quien delega')
    return requestRootGrant({
      walletAddress,
      maxDebit: body.maxDebit ?? (await getMandate(ROOT_ID)).maxDebit,
      interval: body.interval ?? monthly(),
    })
  })

  // OP-03
  app.get<{ Querystring: { interact_ref?: string; hash?: string; result?: string } }>('/callback', async (req, reply) => {
    const { interact_ref, hash, result } = req.query
    if (result === 'grant_rejected' || !interact_ref || !hash) return reply.redirect(`${env.WEB_URL}/juan?ok=0`)
    try {
      const pending = await continueRootGrant(interact_ref, hash)
      // El mandato raíz refleja exactamente lo que Juan aprobó en su billetera.
      const root = await getMandate(ROOT_ID)
      await putMandate({ ...root, maxDebit: pending.maxDebit, interval: pending.interval, revoked: false, frozen: false })
      await emit({
        mandateId: ROOT_ID,
        actor: { type: 'person', name: 'Juan' },
        kind: 'grant',
        amount: pending.maxDebit,
        reason: `Juan aprobó el mandato raíz en su billetera: máx. ${A.format(pending.maxDebit)} por periodo`,
      })
      return reply.redirect(`${env.WEB_URL}/juan?ok=1`)
    } catch (err) {
      req.log.error(err)
      return reply.redirect(`${env.WEB_URL}/juan?ok=0&error=${encodeURIComponent(String(err))}`)
    }
  })
}
