import type {
  Amount,
  Category,
  DeliveryAddress,
  DeliveryRequest,
  DeviceCert,
  FeedEvent,
  Merchant,
  Payment,
  Voucher,
} from '@openroute/shared'
import { sql, type Row, type Sql } from './store/sql.ts'

// Repositorio sobre Postgres (esquema en store/migrations.ts). Cada función recibe opcionalmente la conexión
// para participar en una transacción; por defecto usa la global.

export interface User {
  id: string
  name: string
  documentType: string
  documentNumber: string
  email?: string
  phone?: string
}

export interface Payer {
  userId: string
  walletAddress: string
  assetCode: string
  assetScale: number
}

export interface Agent {
  id: string
  name: string
  role: 'assistant' | 'inventory' | 'guardian'
  walletAddress?: string
}

export interface DeviceKey {
  deviceKeyId: string
  mandateId: string
  publicKey: string
}

export interface PhoneProfile {
  /** Canal: el número del SMS o `app:<persona>` para el chat de la app */
  phone: string
  userId?: string
  name: string
  /** Mandato con el que el Asistente paga compras de esta persona */
  mandateId: string
  /** Mandato con el que el Asistente paga consultas al Agente de Inventario */
  dataMandateId: string
  location: { lat: number; lng: number }
  /** Mandato raíz cuya dirección de entrega aplica (la que registró Juan) */
  rootId: string
  /** Chat de la app: la persona cuyas ramas hablan con este perfil (María desde su celular → 'maria') */
  chatFor?: string
}

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

export interface StoredVoucher {
  voucher: Voucher
  status: 'settled' | 'rejected' | 'flagged'
  reason?: string
  paymentId?: string
  receivedAt: string
}

export interface RootGrant {
  id: string
  walletAddress: string
  accessToken: string
  manageUrl: string
  continueUri: string
  continueToken: string
}

export interface PendingGrant {
  id: string
  walletAddress: string
  authServer: string
  continueUri: string
  continueToken: string
  clientNonce: string
  finishNonce: string
  maxDebit: Amount
  interval: string
}

const s = (conn?: Sql) => conn ?? sql()
/** jsonb: undefined/null → null */
const j = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v))
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v)
/** Quita las claves con valor undefined (así un objeto leído de la base es igual al que se guardó). */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

// ─── Usuarios y quien delega ───
const toUser = (r: Row): User =>
  clean({ id: r.id, name: r.name, documentType: r.document_type, documentNumber: r.document_number, email: opt(r.email), phone: opt(r.phone) })

export const insertUser = async (
  u: User & { password?: { salt: string; hash: string } },
  conn?: Sql,
) => {
  await s(conn).query(
    `insert into users (id, name, document_type, document_number, email, password_salt, password_hash, phone)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [u.id, u.name, u.documentType, u.documentNumber, u.email ?? null, u.password?.salt ?? null, u.password?.hash ?? null, u.phone ?? null],
  )
}

export const getUserWithPassword = async (email: string) => {
  const [r] = await sql().query(`select * from users where lower(email) = lower($1)`, [email])
  return r ? { user: toUser(r), salt: r.password_salt as string | null, hash: r.password_hash as string | null } : undefined
}

export const getUser = async (id: string) => {
  const [r] = await sql().query(`select * from users where id = $1`, [id])
  return r ? toUser(r) : undefined
}

export const insertPayer = async (p: Payer, conn?: Sql) => {
  await s(conn).query(`insert into payers (user_id, wallet_address, asset_code, asset_scale) values ($1, $2, $3, $4)`, [
    p.userId,
    p.walletAddress,
    p.assetCode,
    p.assetScale,
  ])
}

export const getPayer = async (userId: string) => {
  const [r] = await sql().query(`select * from payers where user_id = $1`, [userId])
  return r ? ({ userId: r.user_id, walletAddress: r.wallet_address, assetCode: r.asset_code, assetScale: r.asset_scale } as Payer) : undefined
}

export const setPayerAsset = async (userId: string, asset: { assetCode: string; assetScale: number }) => {
  await sql().query(`update payers set asset_code = $2, asset_scale = $3 where user_id = $1`, [userId, asset.assetCode, asset.assetScale])
}

// ─── Agentes ───
const toAgent = (r: Row): Agent => clean({ id: r.id, name: r.name, role: r.role, walletAddress: opt(r.wallet_address) })

export const insertAgent = async (a: Agent, conn?: Sql) => {
  await s(conn).query(`insert into agents (id, name, role, wallet_address) values ($1, $2, $3, $4)`, [a.id, a.name, a.role, a.walletAddress ?? null])
}
export const getAgent = async (id: string) => {
  const [r] = await sql().query(`select * from agents where id = $1`, [id])
  return r ? toAgent(r) : undefined
}

// ─── Comercios (quien solo recibe) ───
const toMerchant = (r: Row): Merchant =>
  clean({
    id: r.id,
    name: r.name,
    wallet: r.wallet_address,
    category: r.category,
    isAgent: r.is_agent || undefined,
    payout:
      r.payout_via === 'wallet'
        ? { via: 'wallet' as const, wallet: r.payout_wallet }
        : r.payout_via === 'puntored'
          ? { via: 'puntored' as const, llave: r.payout_llave }
          : undefined,
  })

export const upsertMerchant = async (m: Merchant & { ownerUserId?: string }, conn?: Sql) => {
  await s(conn).query(
    `insert into merchants (id, name, category, wallet_address, is_agent, payout_via, payout_wallet, payout_llave, owner_user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (id) do update set name = $2, category = $3, wallet_address = $4, is_agent = $5,
       payout_via = $6, payout_wallet = $7, payout_llave = $8, owner_user_id = coalesce($9, merchants.owner_user_id)`,
    [
      m.id,
      m.name,
      m.category,
      m.wallet,
      !!m.isAgent,
      m.payout?.via ?? null,
      m.payout?.via === 'wallet' ? m.payout.wallet : null,
      m.payout?.via === 'puntored' ? m.payout.llave : null,
      m.ownerUserId ?? null,
    ],
  )
}
export const listMerchants = async () => (await sql().query(`select * from merchants order by name`)).map(toMerchant)
export const getMerchant = async (id: string) => {
  const [r] = await sql().query(`select * from merchants where id = $1`, [id])
  return r ? toMerchant(r) : undefined
}
export const merchantByWallet = async (wallet: string) => {
  const [r] = await sql().query(`select * from merchants where wallet_address = $1`, [wallet])
  return r ? toMerchant(r) : undefined
}

// ─── Perfiles del Asistente (SMS / chat) ───
const toProfile = (r: Row): PhoneProfile =>
  clean({
    phone: r.channel,
    userId: opt(r.user_id),
    name: r.name,
    mandateId: r.mandate_id,
    dataMandateId: r.data_mandate_id,
    location: { lat: r.lat, lng: r.lng },
    rootId: r.root_id,
    chatFor: opt(r.chat_for),
  })

export const insertProfile = async (p: PhoneProfile, conn?: Sql) => {
  await s(conn).query(
    `insert into profiles (channel, user_id, name, mandate_id, data_mandate_id, lat, lng, root_id, chat_for)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [p.phone, p.userId ?? null, p.name, p.mandateId, p.dataMandateId, p.location.lat, p.location.lng, p.rootId, p.chatFor ?? null],
  )
}
export const getProfile = async (channel: string) => {
  const [r] = await sql().query(`select * from profiles where channel = $1`, [channel])
  return r ? toProfile(r) : undefined
}
export const profileForChat = async (personMandateIds: string[]) => {
  const [r] = await sql().query(`select * from profiles where chat_for = any($1::text[]) limit 1`, [personMandateIds])
  return r ? toProfile(r) : undefined
}

// ─── Dirección de entrega por mandato raíz ───
export const getAddress = async (rootId: string): Promise<DeliveryAddress | null> => {
  const [r] = await sql().query(`select * from delivery_addresses where root_id = $1`, [rootId])
  return r ? { recipientName: r.recipient_name, address: r.address } : null
}
export const putAddress = async (rootId: string, a: DeliveryAddress, conn?: Sql) => {
  await s(conn).query(
    `insert into delivery_addresses (root_id, recipient_name, address) values ($1, $2, $3)
     on conflict (root_id) do update set recipient_name = $2, address = $3`,
    [rootId, a.recipientName, a.address],
  )
}

// ─── Grants raíz (el permiso de quien delega) ───
const toRootGrant = (r: Row): RootGrant => ({
  id: r.id,
  walletAddress: r.wallet_address,
  accessToken: r.access_token,
  manageUrl: r.manage_url,
  continueUri: r.continue_uri,
  continueToken: r.continue_token,
})

export const getActiveGrant = async (rootId: string, conn?: Sql) => {
  const [r] = await s(conn).query(
    `select * from root_grants where root_mandate_id = $1 and status = 'active' order by updated_at desc limit 1`,
    [rootId],
  )
  return r ? toRootGrant(r) : null
}

export const getPendingGrant = async (rootId: string): Promise<PendingGrant | null> => {
  const [r] = await sql().query(
    `select * from root_grants where root_mandate_id = $1 and status = 'pending' order by created_at desc limit 1`,
    [rootId],
  )
  return r
    ? {
        id: r.id,
        walletAddress: r.wallet_address,
        authServer: r.auth_server,
        continueUri: r.continue_uri,
        continueToken: r.continue_token,
        clientNonce: r.client_nonce,
        finishNonce: r.finish_nonce,
        maxDebit: r.max_debit,
        interval: r.interval,
      }
    : null
}

export const insertPendingGrant = async (rootId: string, payerId: string | null, g: PendingGrant) => {
  await sql().query(
    `insert into root_grants (id, root_mandate_id, payer_id, status, wallet_address, max_debit, interval, auth_server,
       client_nonce, finish_nonce, continue_uri, continue_token)
     values ($1, $2, $3, 'pending', $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
    [g.id, rootId, payerId, g.walletAddress, j(g.maxDebit), g.interval, g.authServer, g.clientNonce, g.finishNonce, g.continueUri, g.continueToken],
  )
}

/** El grant pendiente pasa a activo (con sus tokens); el activo anterior queda reemplazado. */
export const activateGrant = async (
  rootId: string,
  id: string,
  t: { accessToken: string; manageUrl: string; continueUri: string; continueToken: string },
) =>
  sql().tx(async (tx) => {
    await tx.query(`update root_grants set status = 'replaced', updated_at = now() where root_mandate_id = $1 and status = 'active'`, [rootId])
    await tx.query(
      `update root_grants set status = 'active', access_token = $2, manage_url = $3, continue_uri = $4, continue_token = $5,
         updated_at = now() where id = $1`,
      [id, t.accessToken, t.manageUrl, t.continueUri, t.continueToken],
    )
  })

export const updateGrantToken = async (id: string, accessToken: string, manageUrl: string) => {
  await sql().query(`update root_grants set access_token = $2, manage_url = $3, updated_at = now() where id = $1`, [id, accessToken, manageUrl])
}

export const setGrantStatus = async (id: string, status: 'revoked' | 'replaced') => {
  await sql().query(`update root_grants set status = $2, updated_at = now() where id = $1`, [id, status])
}

// ─── Pagos ───
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

export const insertPayment = async (p: Payment) => {
  await sql().query(
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
export const updatePayment = async (p: Payment) => {
  await sql().query(
    `update payments set amount = $2::jsonb, receive_amount = $3::jsonb, status = $4, outgoing_payment_id = $5,
       payout = $6::jsonb, delivery = $7::jsonb where id = $1`,
    [p.id, j(p.amount), j(p.receiveAmount), p.status, p.outgoingPaymentId ?? null, j(p.payout), j(p.delivery)],
  )
}

export const deletePayment = async (id: string) => {
  await sql().query(`delete from payments where id = $1`, [id])
}
export const getPayment = async (id: string) => {
  const [r] = await sql().query(`select * from payments where id = $1`, [id])
  return r ? toPayment(r) : undefined
}
/** Pedidos de un comercio: pagos completados con modo de entrega, del más nuevo al más viejo. */
export const ordersFor = async (wallet: string) =>
  (
    await sql().query(
      `select * from payments where merchant_wallet = $1 and delivery is not null and status = 'completed' order by created_at desc`,
      [wallet],
    )
  ).map(toPayment)

// ─── Compras que esperan PIN ───
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

export const insertPending = async (p: Pending) => {
  await sql().query(
    `insert into pending_purchases (id, mandate_id, merchant_wallet, amount, price, category, reason, delivery, attempts, expires_at)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9, $10)`,
    [p.id, p.mandateId, p.merchantWallet, j(p.amount), j(p.price), p.category, p.reason, j(p.delivery), p.attempts, p.expiresAt],
  )
}
export const getPending = async (id: string) => {
  const [r] = await sql().query(`select * from pending_purchases where id = $1`, [id])
  return r ? toPending(r) : undefined
}
export const setPendingAttempts = async (id: string, attempts: number) => {
  await sql().query(`update pending_purchases set attempts = $2 where id = $1`, [id, attempts])
}
export const deletePending = async (id: string) => {
  await sql().query(`delete from pending_purchases where id = $1`, [id])
}

// ─── Dispositivos y certificados (modo sin señal) ───
export const findDevice = async (mandateId: string, publicKey: string) => {
  const [r] = await sql().query(`select * from device_keys where mandate_id = $1 and public_key = $2`, [mandateId, publicKey])
  return r ? ({ deviceKeyId: r.device_key_id, mandateId: r.mandate_id, publicKey: r.public_key } as DeviceKey) : undefined
}
export const insertDevice = async (d: DeviceKey) => {
  await sql().query(`insert into device_keys (device_key_id, mandate_id, public_key) values ($1, $2, $3)`, [d.deviceKeyId, d.mandateId, d.publicKey])
}
export const insertCert = async (c: DeviceCert) => {
  await sql().query(`insert into device_certs (cert_id, device_key_id, mandate_id, cert) values ($1, $2, $3, $4::jsonb)`, [
    c.certId,
    c.deviceKeyId,
    c.mandateId,
    j(c),
  ])
}
export const getCert = async (certId: string) => {
  const [r] = await sql().query(`select cert from device_certs where cert_id = $1`, [certId])
  return r ? (r.cert as DeviceCert) : undefined
}

// ─── Vales ───
const toVoucher = (r: Row): StoredVoucher =>
  clean({ voucher: r.voucher, status: r.status, reason: opt(r.reason), paymentId: opt(r.payment_id), receivedAt: iso(r.received_at) })

export const getVoucher = async (key: string) => {
  const [r] = await sql().query(`select * from vouchers where key = $1`, [key])
  return r ? toVoucher(r) : undefined
}
export const putVoucher = async (key: string, v: StoredVoucher) => {
  await sql().query(
    `insert into vouchers (key, voucher, device_key_id, mandate_id, status, reason, payment_id, received_at)
     values ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
     on conflict (key) do update set voucher = $2::jsonb, status = $5, reason = $6, payment_id = $7, received_at = $8`,
    [key, j(v.voucher), v.voucher.deviceKeyId, v.voucher.deviceCert.mandateId, v.status, v.reason ?? null, v.paymentId ?? null, v.receivedAt],
  )
}
export const listVouchers = async () => (await sql().query(`select * from vouchers order by received_at desc`)).map(toVoucher)
export const vouchersOfDevices = async (deviceKeyIds: string[]) =>
  (await sql().query(`select * from vouchers where device_key_id = any($1::text[])`, [deviceKeyIds])).map(toVoucher)
export const vouchersOfMandate = async (mandateId: string) =>
  (await sql().query(`select * from vouchers where mandate_id = $1`, [mandateId])).map(toVoucher)

// ─── Feed ───
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

export const insertEvent = async (e: FeedEvent) => {
  await sql().query(
    `insert into feed_events (id, at, mandate_id, kind, actor, amount, merchant, reason, delivery, payout)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb)`,
    [e.id, e.at, e.mandateId, e.kind, j(e.actor), j(e.amount), e.merchant ?? null, e.reason ?? null, j(e.delivery), j(e.payout)],
  )
}
/** Los últimos `n` eventos, del más viejo al más nuevo. */
export const recentEvents = async (n: number) =>
  (await sql().query(`select * from (select * from feed_events order by seq desc limit $1) e order by seq asc`, [n])).map(toEvent)

// ─── Meta ───
export const getMeta = async (key: string) => (await sql().query(`select value from meta where key = $1`, [key]))[0]?.value as string | undefined
export const setMeta = async (key: string, value: string, conn?: Sql) => {
  await s(conn).query(`insert into meta (key, value) values ($1, $2) on conflict (key) do update set value = $2`, [key, value])
}

/** Quien delega el mandato raíz: la cuenta titular de la raíz con su wallet (tabla payers). */
export const payerOfRoot = async (rootId: string) => {
  const [r] = await sql().query(
    `select p.* from payers p join mandates m on m.holder_user_id = p.user_id where m.id = $1`,
    [rootId],
  )
  return r ? ({ userId: r.user_id, walletAddress: r.wallet_address, assetCode: r.asset_code, assetScale: r.asset_scale } as Payer) : undefined
}
