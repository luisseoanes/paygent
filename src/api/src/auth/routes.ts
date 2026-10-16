import type { FastifyInstance } from 'fastify'
import { getPayer, getUserWithPassword } from '../db.ts'
import { HttpError, badRequest } from '../gateway/errors.ts'
import { checkSecret } from '../gateway/pin.ts'
import { sql } from '../store/sql.ts'

/** Lo que es una cuenta en la demo: quien delega (payer), quien recibe una delegación o quien cobra (tendero). */
export type Rol = 'juan' | 'maria' | 'tendero'

/**
 * Login con correo y contraseña (scrypt con salt en la tabla users). Devuelve la cuenta y su rol para que la web
 * sepa a qué app llevarla. Todavía no emite sesión: los endpoints del panel siguen abiertos (pendiente).
 */
export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req) => {
    const email = req.body?.email?.trim()
    const password = req.body?.password ?? ''
    if (!email || !password) throw badRequest('Faltan el correo o la contraseña')
    const found = await getUserWithPassword(email)
    const ok = found?.salt && found.hash && checkSecret(password, { salt: found.salt, hash: found.hash })
    if (!found || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos')

    const { user } = found
    const payer = await getPayer(user.id)
    const [root] = await sql().query<{ id: string }>(`select id from mandates where holder_user_id = $1 and parent_id is null`, [user.id])
    const branches = await sql().query<{ id: string }>(`select id from mandates where holder_user_id = $1 and parent_id is not null order by id`, [
      user.id,
    ])
    const [shop] = await sql().query<{ id: string }>(`select id from merchants where owner_user_id = $1`, [user.id])
    const role: Rol = payer ? 'juan' : shop ? 'tendero' : 'maria'
    return {
      user,
      role,
      walletAddress: payer?.walletAddress ?? null,
      rootMandateId: root?.id ?? null,
      mandateIds: branches.map((b) => b.id),
      merchantId: shop?.id ?? null,
    }
  })
}
