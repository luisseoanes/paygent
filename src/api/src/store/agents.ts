import { s, opt, clean, type Row, type Sql } from './rows.ts'

// Agentes: filas de la tabla agents (una sola credencial para el servicio).

export interface Agent {
  id: string
  name: string
  role: 'assistant' | 'inventory' | 'guardian'
  walletAddress?: string
}

const toAgent = (r: Row): Agent => clean({ id: r.id, name: r.name, role: r.role, walletAddress: opt(r.wallet_address) })

export const insertAgent = async (a: Agent, conn?: Sql) => {
  await s(conn).query(`insert into agents (id, name, role, wallet_address) values ($1, $2, $3, $4)`, [a.id, a.name, a.role, a.walletAddress ?? null])
}
export const getAgent = async (id: string, conn?: Sql) => {
  const [r] = await s(conn).query(`select * from agents where id = $1`, [id])
  return r ? toAgent(r) : undefined
}
