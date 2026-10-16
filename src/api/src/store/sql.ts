import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import pg from 'pg'
import { env } from '../env.ts'
import { migrate } from './migrations.ts'

// Persistencia en Postgres. En Railway, el Postgres del proyecto (DATABASE_URL). Sin DATABASE_URL, PGlite:
// Postgres embebido en .data/pglite (desarrollo local sin instalar nada) o en memoria (tests).
// Las dos implementaciones cumplen la misma interfaz y devuelven los mismos tipos.

export type Row = Record<string, any>

export interface Sql {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>
  /** Varias sentencias sin parámetros (migraciones). */
  exec(text: string): Promise<void>
  /** Todo o nada. Dentro de una transacción, `tx` reutiliza la misma. */
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T>
}

const fromPglite = (db: PGlite | Transaction): Sql => {
  const self: Sql = {
    query: async <T extends Row>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
    exec: async (text) => {
      await db.exec(text)
    },
    tx: (fn) => ('transaction' in db ? db.transaction((t) => fn(fromPglite(t))) : fn(self)),
  }
  return self
}

const fromPgClient = (client: pg.PoolClient): Sql => {
  const self: Sql = {
    query: async <T extends Row>(text: string, params?: unknown[]) => (await client.query(text, params)).rows as T[],
    exec: async (text) => {
      await client.query(text)
    },
    tx: (fn) => fn(self),
  }
  return self
}

const fromPgPool = (pool: pg.Pool): Sql => ({
  query: async <T extends Row>(text: string, params?: unknown[]) => (await pool.query(text, params)).rows as T[],
  exec: async (text) => {
    await pool.query(text)
  },
  tx: async (fn) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(fromPgClient(client))
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
})

let current: Sql | null = null

export const sql = (): Sql => {
  if (!current) throw new Error('La base de datos no está iniciada (initStore)')
  return current
}

export const isStoreReady = () => current !== null

/** Conecta y aplica las migraciones pendientes. Idempotente. */
export const initStore = async () => {
  if (current) return current
  if (process.env.DATABASE_URL) {
    current = fromPgPool(new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }))
  } else if (process.env.VITEST) {
    current = fromPglite(new PGlite())
  } else {
    const dir = join(env.DATA_DIR, 'pglite')
    mkdirSync(dir, { recursive: true })
    current = fromPglite(new PGlite(dir))
  }
  await migrate(current)
  return current
}
