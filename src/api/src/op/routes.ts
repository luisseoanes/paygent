import type { FastifyInstance } from 'fastify'
import { amount as A, monthly, type Amount } from '@openroute/shared'
import { db } from '../db.ts'
import { env } from '../env.ts'
import { emit } from '../feed/bus.ts'
import { getMandate, putMandate, ROOT_ID } from '../gateway/mandates.ts'
import { getWallet } from './client.ts'
import { continueRootGrant, requestRootGrant } from './grants.ts'

export default async function opRoutes(app: FastifyInstance) {
  // OP-01
  app.get('/health/op', async () => {
    if (env.MOCK_OP) return { mock: true, rootGrant: !!db.rootGrant }
    return { mock: false, rootGrant: !!db.rootGrant, juan: await getWallet(env.WALLET_JUAN) }
  })

  // OP-02
  app.post<{ Body: { walletAddress?: string; maxDebit?: Amount; interval?: string } }>('/mandates/root', async (req) => {
    const body = req.body ?? {}
    return requestRootGrant({
      walletAddress: body.walletAddress ?? env.WALLET_JUAN,
      maxDebit: body.maxDebit ?? getMandate(ROOT_ID).maxDebit,
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
      const root = getMandate(ROOT_ID)
      putMandate({ ...root, maxDebit: pending.maxDebit, interval: pending.interval, revoked: false, frozen: false })
      emit({
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
