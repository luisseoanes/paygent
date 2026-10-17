import type { Amount, Category, DeliveryRequest, Payment } from '@openroute/shared'
import { s, j, opt, iso, clean, type Row, type Sql } from './rows.ts'

// Pagos y compras que esperan PIN.

export interface Pending {
  id: string
  mandateId: string
  merchantWallet: string
  amount: Amount
  category: Category
  reason: string
  delivery?: DeliveryRequest
  price?: Amount
  attempts: number
  expiresAt: string
}

const toPayment = (r: Row): Payment =>
  clean({
    id: r.id,
    mandateId: r.mandate_id,
    merchantWallet: r.merchant_wallet,
    amount: r.amount,
    category: r.category,
    reason: r.reason,
    status: r.status,
    outgoingPaymentId: opt(r.outgoing_payment_id),
    createdAt: iso(r.created_at),
    delivery: opt(r.delivery),
    payout: opt(r.payout),
    price: opt(r.price),
    receiveAmount: opt(r.receive_amount),
  })

export const insertPayment = async (p: Payment, conn?: Sql) => {
  await s(conn).query(
    `insert into payments (id, mandate_id, merchant_wallet, amount, price, receive_amount, category, reason, status,
       outgoing_payment_id, delivery, payout, created_at)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)`,
    [
      p.id,
      p.mandateId,
      p.merchantWallet,
      j(p.amount),
      j(p.price),
      j(p.receiveAmount),
      p.category,
      p.reason,
      p.status,
      p.outgoingPaymentId ?? null,
      j(p.delivery),
      j(p.payout),
      p.createdAt,
    ],
  )
}

/** Guarda el estado completo del pago (después de liquidar, o cuando llega el resultado tardío). */
export const updatePayment = async (p: Payment, conn?: Sql) => {
  await s(conn).query(
    `update payments set amount = $2::jsonb, receive_amount = $3::jsonb, status = $4, outgoing_payment_id = $5,
       payout = $6::jsonb, delivery = $7::jsonb where id = $1`,
    [p.id, j(p.amount), j(p.receiveAmount), p.status, p.outgoingPaymentId ?? null, j(p.payout), j(p.delivery)],
  )
}

export const deletePayment = async (id: string, conn?: Sql) => {
  await s(conn).query(`delete from payments where id = $1`, [id])
}
export const getPayment = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from payments where id = $1`, [id])
  return r ? toPayment(r) : undefined
}
/** Pedidos de un comercio: pagos completados con modo de entrega, del más nuevo al más viejo. */
export const ordersFor = async (wallet: string, conn?: Sql) =>
  (
    await s(conn).query(
      `select * from payments where merchant_wallet = $1 and delivery is not null and status = 'completed' order by created_at desc`,
      [wallet],
    )
  ).map(toPayment)

/** Todos los pagos a un comercio (cualquier estado), del más nuevo al más viejo. */
export const paymentsTo = async (wallet: string, limit = 200, conn?: Sql) =>
  (await s(conn).query(`select * from payments where merchant_wallet = $1 order by created_at desc, id limit $2`, [wallet, limit])).map(
    toPayment,
  )

const toPending = (r: Row): Pending =>
  clean({
    id: r.id,
    mandateId: r.mandate_id,
    merchantWallet: r.merchant_wallet,
    amount: r.amount,
    category: r.category,
    reason: r.reason,
    delivery: opt(r.delivery),
    price: opt(r.price),
    attempts: r.attempts,
    expiresAt: iso(r.expires_at),
  })

export const insertPending = async (p: Pending, conn?: Sql) => {
  await s(conn).query(
    `insert into pending_purchases (id, mandate_id, merchant_wallet, amount, price, category, reason, delivery, attempts, expires_at)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9, $10)`,
    [p.id, p.mandateId, p.merchantWallet, j(p.amount), j(p.price), p.category, p.reason, j(p.delivery), p.attempts, p.expiresAt],
  )
}
export const getPending = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from pending_purchases where id = $1`, [id])
  return r ? toPending(r) : undefined
}
export const setPendingAttempts = async (id: string, attempts: number, conn?: Sql) => {
  await s(conn).query(`update pending_purchases set attempts = $2 where id = $1`, [id, attempts])
}
/** Reclama la compra pendiente borrándola: solo una confirmación simultánea la obtiene. */
export const takePending = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`delete from pending_purchases where id = $1 returning *`, [id])
  return r ? toPending(r) : undefined
}
export const deletePending = async (id: string, conn?: Sql) => {
  await s(conn).query(`delete from pending_purchases where id = $1`, [id])
}
