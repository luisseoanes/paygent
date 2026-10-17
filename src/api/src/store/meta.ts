import { s, type Row, type Sql } from './rows.ts'

// Claves sueltas (versión de la semilla…).

export const getMeta = async (key: string, conn?: Sql) => (await s(conn).query(`select value from meta where key = $1`, [key]))[0]?.value as string | undefined
export const setMeta = async (key: string, value: string, conn?: Sql) => {
  await s(conn).query(`insert into meta (key, value) values ($1, $2) on conflict (key) do update set value = $2`, [key, value])
}
