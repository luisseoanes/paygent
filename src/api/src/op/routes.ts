import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { amount as A, monthly, type Amount } from '@openroute/shared'
import { getActiveGrant, payerOfRoot } from '../db.ts'
import { env } from '../env.ts'
import { emit } from '../feed/bus.ts'
import { badRequest } from '../gateway/errors.ts'
import { fitChildren, getMandate, putMandate, ROOT_ID } from '../gateway/mandates.ts'
import { sql } from '../store/sql.ts'
import { getWallet } from './client.ts'
import { continueRootGrant, requestRootGrant } from './grants.ts'

type CallbackQuery = { interact_ref?: string; hash?: string; result?: string }

export default async function opRoutes(app: FastifyInstance) {
  // OP-01
  app.get<{ Querystring: { root?: string } }>('/health/op', async (req) => {
    const rootId = req.query.root ?? ROOT_ID
    const rootGrant = !!(await getActiveGrant(rootId))
    if (env.MOCK_OP) return { mock: true, rootGrant }
    const payer = await payerOfRoot(rootId)
    return { mock: false, rootGrant, juan: payer ? await getWallet(payer.walletAddress) : null }
  })

  // OP-02: el grant del titular dueño de esa raíz (por defecto, la de la demo).
  app.post<{ Body: { rootMandateId?: string; walletAddress?: string; maxDebit?: Amount; interval?: string } }>(
    '/mandates/root',
    async (req) => {
      const body = req.body ?? {}
      const rootId = body.rootMandateId ?? ROOT_ID
      const root = await getMandate(rootId)
      if (root.parentId) throw badRequest('Ese mandato no es una raíz')
      // La wallet es la de quien delega (tabla payers); el cuerpo puede indicarla, pero no hace falta.
      const walletAddress = body.walletAddress ?? (await payerOfRoot(rootId))?.walletAddress
      if (!walletAddress) throw badRequest('No hay una wallet registrada para quien delega')
      return requestRootGrant({ rootId, walletAddress, maxDebit: body.maxDebit ?? root.maxDebit, interval: body.interval ?? monthly() })
    },
  )

  // OP-03: la billetera vuelve aquí. /callback es la raíz de la demo; /callback/:rootId, la de cada titular.
  const callback = async (rootId: string, req: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => {
    const { interact_ref, hash, result } = req.query
    if (result === 'grant_rejected' || !interact_ref || !hash) return reply.redirect(`${env.WEB_URL}/juan?ok=0`)
    try {
      const pending = await continueRootGrant(interact_ref, hash, rootId)
      // El mandato raíz refleja exactamente lo que el titular aprobó en su billetera. Si es menos de lo que ya
      // repartió, sus ramas bajan en proporción en la misma transacción: la suma nunca supera lo firmado.
      const root = await getMandate(rootId)
      const ajustadas = await sql().tx(async (tx) => {
        await putMandate({ ...root, maxDebit: pending.maxDebit, interval: pending.interval, revoked: false, frozen: false }, tx)
        return fitChildren(rootId, tx)
      })
      await emit({
        mandateId: rootId,
        actor: { type: 'person', name: root.holderName },
        kind: 'grant',
        amount: pending.maxDebit,
        reason: `${root.holderName} aprobó el mandato raíz en su billetera: máx. ${A.format(pending.maxDebit)} por periodo`,
      })
      const directas = ajustadas.filter((m) => m.parentId === rootId)
      if (directas.length)
        await emit({
          mandateId: rootId,
          actor: { type: 'person', name: root.holderName },
          kind: 'guardian',
          reason: `El mandato nuevo es menor que lo repartido: los topes bajaron en proporción (${directas
            .map((m) => `${m.holderName} ${A.format(m.maxDebit)}`)
            .join(', ')})`,
        })
      return reply.redirect(`${env.WEB_URL}/juan?ok=1`)
    } catch (err) {
      req.log.error(err)
      return reply.redirect(`${env.WEB_URL}/juan?ok=0&error=${encodeURIComponent(String(err))}`)
    }
  }
  app.get<{ Querystring: CallbackQuery }>('/callback', (req, reply) => callback(ROOT_ID, req, reply))
  app.get<{ Params: { rootId: string }; Querystring: CallbackQuery }>('/callback/:rootId', (req, reply) =>
    callback(req.params.rootId, req, reply),
  )
}
