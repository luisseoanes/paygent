import type { Row, Sql } from './sql.ts'
import { sql } from './sql.ts'

// Ayudas de los repositorios: cada función recibe opcionalmente la conexión (`tx`) para participar en una
// transacción; por defecto usa la global.

export const s = (conn?: Sql) => conn ?? sql()
/** jsonb: undefined/null → null */
export const j = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v))
export const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
export const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v)
/** Quita las claves con valor undefined (así un objeto leído de la base es igual al que se guardó). */
export const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
export type { Row, Sql }
