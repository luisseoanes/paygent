import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomId } from '@openroute/shared'
import { env } from '../env.ts'
import { sql } from './sql.ts'

/**
 * Migración única desde la base en JSON (.data/db.json, el volumen de antes de Postgres): trae el grant activo de
 * Juan para no tener que volver a firmar el mandato. El resto de la demo se vuelve a sembrar.
 */
export const importLegacyGrant = async (rootId: string) => {
  const file = join(env.DATA_DIR, 'db.json')
  if (process.env.VITEST || !existsSync(file)) return false
  const [{ n }] = await sql().query<{ n: number }>(`select count(*)::int as n from root_grants`)
  if (n > 0) return false
  let legacy: { rootGrant?: { walletAddress: string; accessToken: string; manageUrl: string; continueUri: string; continueToken: string } | null; mandates?: Record<string, { maxDebit: unknown; interval: string }> }
  try {
    legacy = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return false
  }
  const g = legacy.rootGrant
  const root = legacy.mandates?.[rootId]
  if (!g || !root) return false
  await sql().query(
    `insert into root_grants (id, root_mandate_id, status, wallet_address, max_debit, interval, continue_uri, continue_token,
       access_token, manage_url)
     values ($1, $2, 'active', $3, $4::jsonb, $5, $6, $7, $8, $9)`,
    [randomId('grant_'), rootId, g.walletAddress, JSON.stringify(root.maxDebit), root.interval, g.continueUri, g.continueToken, g.accessToken, g.manageUrl],
  )
  console.log('[db] grant de Juan importado de .data/db.json')
  return true
}
