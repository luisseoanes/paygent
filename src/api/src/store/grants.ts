import type { Amount } from '@openroute/shared'
import { s, j, type Row, type Sql } from './rows.ts'
import { sql } from './sql.ts'

// Grants raíz de Open Payments (el permiso que firma quien delega).

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

export const getPendingGrant = async (rootId: string, conn?: Sql): Promise<PendingGrant | null> => {
  const [r] = await s(conn).query(
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

export const insertPendingGrant = async (rootId: string, payerId: string | null, g: PendingGrant, conn?: Sql) => {
  await s(conn).query(
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

export const updateGrantToken = async (id: string, accessToken: string, manageUrl: string, conn?: Sql) => {
  await s(conn).query(`update root_grants set access_token = $2, manage_url = $3, updated_at = now() where id = $1`, [id, accessToken, manageUrl])
}

export const setGrantStatus = async (id: string, status: 'revoked' | 'replaced', conn?: Sql) => {
  await s(conn).query(`update root_grants set status = $2, updated_at = now() where id = $1`, [id, status])
}
