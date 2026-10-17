import type { FeedEvent } from '@openroute/shared'
import { s, j, opt, iso, clean, type Row, type Sql } from './rows.ts'

// Libreta (feed_events).

const toEvent = (r: Row): FeedEvent =>
  clean({
    id: r.id,
    at: iso(r.at),
    mandateId: r.mandate_id,
    actor: r.actor,
    kind: r.kind,
    amount: opt(r.amount),
    merchant: opt(r.merchant),
    reason: opt(r.reason),
    delivery: opt(r.delivery),
    payout: opt(r.payout),
  })

export const insertEvent = async (e: FeedEvent, conn?: Sql) => {
  await s(conn).query(
    `insert into feed_events (id, at, mandate_id, kind, actor, amount, merchant, reason, delivery, payout)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb)`,
    [e.id, e.at, e.mandateId, e.kind, j(e.actor), j(e.amount), e.merchant ?? null, e.reason ?? null, j(e.delivery), j(e.payout)],
  )
}
/** Los últimos `n` eventos, del más viejo al más nuevo. Con `rootId`, solo los del árbol de ese titular. */
export const recentEvents = async (n: number, rootId?: string, conn?: Sql) =>
  (
    await s(conn).query(
      rootId
        ? `with recursive tree as (
             select id from mandates where id = $2
             union all
             select m.id from mandates m join tree t on m.parent_id = t.id
           )
           select * from (select * from feed_events where mandate_id in (select id from tree) order by seq desc limit $1) e
           order by seq asc`
        : `select * from (select * from feed_events order by seq desc limit $1) e order by seq asc`,
      rootId ? [n, rootId] : [n],
    )
  ).map(toEvent)

/** ¿El mandato pertenece al árbol de esa raíz? (para filtrar el feed en vivo por titular) */
export const inTree = async (mandateId: string, rootId: string, conn?: Sql) => {
  const rows = await s(conn).query(
    `with recursive chain as (
       select id, parent_id from mandates where id = $1
       union all
       select m.id, m.parent_id from mandates m join chain c on m.id = c.parent_id
     ) select 1 from chain where id = $2`,
    [mandateId, rootId],
  )
  return rows.length > 0
}
