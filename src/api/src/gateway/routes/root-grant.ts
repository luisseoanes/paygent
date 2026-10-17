import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { monthly, type Amount } from '@openroute/shared'
import { requireTitularOf } from '../../auth/guards.ts'
import { payerOfRoot } from '../../store/accounts.ts'
import { getActiveGrant } from '../../store/grants.ts'
import { DEMO_ROOT_ID } from '../../demo/constants.ts'
import { env } from '../../env.ts'
import { badRequest } from '../errors.ts'
import { getMandate } from '../mandates.ts'
import { applySignedRoot } from '../root.ts'
import { amountSchema } from '../../http/schemas.ts'
import { getWallet } from '../../op/client.ts'
import { continueRootGrant, requestRootGrant } from '../../op/grants.ts'

type CallbackQuery = { interact_ref?: string; hash?: string; result?: string }

export default async function rootGrantRoutes(app: FastifyInstance) {
  // OP-01
  app.get<{ Querystring: { root?: string } }>('/health/op', async (req) => {
    const rootId = req.query.root ?? DEMO_ROOT_ID
    const rootGrant = !!(await getActiveGrant(rootId))
    if (env.MOCK_OP) return { mock: true, rootGrant }
    const payer = await payerOfRoot(rootId)
    return { mock: false, rootGrant, juan: payer ? await getWallet(payer.walletAddress) : null }
  })

  // OP-02: el grant interactivo de la raíz del titular con sesión.
  app.post<{ Body: { rootMandateId?: string; walletAddress?: string; maxDebit?: Amount; interval?: string } }>(
    '/mandates/root',
    {
      schema: {
        body: {
          type: 'object',
          properties: { rootMandateId: { type: 'string' }, walletAddress: { type: 'string' }, maxDebit: amountSchema, interval: { type: 'string' } },
        },
      },
    },
    async (req) => {
      const body = req.body ?? {}
      const rootId = body.rootMandateId ?? DEMO_ROOT_ID
      await requireTitularOf(req, rootId)
      const root = await getMandate(rootId)
      if (root.parentId) throw badRequest('Ese mandato no es una raíz')
      // La wallet es la de quien delega (tabla payers); el cuerpo puede indicarla, pero no hace falta.
      const walletAddress = body.walletAddress ?? (await payerOfRoot(rootId))?.walletAddress
      if (!walletAddress) throw badRequest('No hay una wallet registrada para quien delega')
      return requestRootGrant({ rootId, walletAddress, maxDebit: body.maxDebit ?? root.maxDebit, interval: body.interval ?? monthly() })
    },
  )

  // OP-03: la billetera vuelve aquí con interact_ref y hash (se verifican en continueRootGrant).
  const callback = async (rootId: string, req: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => {
    const { interact_ref, hash, result } = req.query
    if (result === 'grant_rejected' || !interact_ref || !hash) return reply.redirect(`${env.WEB_URL}/juan?ok=0`)
    try {
      const pending = await continueRootGrant(interact_ref, hash, rootId)
      await applySignedRoot(rootId, pending)
      return reply.redirect(`${env.WEB_URL}/juan?ok=1`)
    } catch (err) {
      req.log.error(err)
      return reply.redirect(`${env.WEB_URL}/juan?ok=0&error=${encodeURIComponent(String(err))}`)
    }
  }
  app.get<{ Params: { rootId: string }; Querystring: CallbackQuery }>('/callback/:rootId', (req, reply) =>
    callback(req.params.rootId, req, reply),
  )
}
