import type { Merchant } from '@openroute/shared'
import { s, clean, type Row, type Sql } from './rows.ts'

// Comercios: quien solo recibe.

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
export const listMerchants = async (conn?: Sql) => (await s(conn).query(`select * from merchants order by name`)).map(toMerchant)
export const getMerchant = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from merchants where id = $1`, [id])
  return r ? toMerchant(r) : undefined
}
export const merchantByWallet = async (wallet: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from merchants where wallet_address = $1`, [wallet])
  return r ? toMerchant(r) : undefined
}


export const merchantOwner = async (id: string, conn?: Sql) =>
  (await s(conn).query<{ owner_user_id: string | null }>(`select owner_user_id from merchants where id = $1`, [id]))[0]?.owner_user_id ?? undefined

export const shopOfUser = async (userId: string, conn?: Sql) =>
  (await s(conn).query<{ id: string }>(`select id from merchants where owner_user_id = $1`, [userId]))[0]?.id
