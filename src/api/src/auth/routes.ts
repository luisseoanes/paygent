import type { FastifyInstance } from 'fastify'
import { amount as A, monthly, randomId, type Mandate } from '@openroute/shared'
import { getPayer, getUser, getUserWithPassword, insertPayer, insertUser, type User } from '../db.ts'
import { env } from '../env.ts'
import { HttpError, badRequest } from '../gateway/errors.ts'
import { findMandate, linkHolderUser, putMandate } from '../gateway/mandates.ts'
import { linkModeProfiles } from '../gateway/modes.ts'
import { checkSecret, hashSecret } from '../gateway/pin.ts'
import { getWallet } from '../op/client.ts'
import { sql } from '../store/sql.ts'

/** Lo que es una cuenta: quien delega (titular), quien recibe una delegación (beneficiario) o quien cobra (tendero). */
export type Rol = 'titular' | 'beneficiario' | 'tendero'

/** Tope inicial de la raíz de un titular nuevo, en pesos. Al firmar en su billetera queda el que él apruebe. */
const TOPE_INICIAL_COP = 1_200_000

/** La cuenta con lo que necesita la web (misma forma que su tipo User) y su rol. */
const sessionOf = async (user: User) => {
  const payer = await getPayer(user.id)
  const [root] = await sql().query<{ id: string }>(`select id from mandates where holder_user_id = $1 and parent_id is null`, [user.id])
  // Primero la del celular: es la que enlaza la billetera (/billetera la usa como código).
  const branches = await sql().query<{ id: string }>(
    `select id from mandates where holder_user_id = $1 and parent_id is not null and not revoked
     order by (holder_type = 'device') desc, id`,
    [user.id],
  )
  const [shop] = await sql().query<{ id: string }>(`select id from merchants where owner_user_id = $1`, [user.id])
  const role: Rol = payer ? 'titular' : shop ? 'tendero' : 'beneficiario'
  return {
    id: user.id,
    role,
    name: user.name,
    apellido: user.lastName,
    documento: user.documentNumber,
    telefono: user.phone,
    email: user.email,
    walletAddress: payer?.walletAddress ?? null,
    rootMandateId: root?.id ?? null,
    mandateId: branches[0]?.id ?? null,
    mandateIds: branches.map((b) => b.id),
    merchantId: shop?.id ?? null,
    user,
  }
}

const required = (body: Record<string, unknown> | undefined, fields: string[]) => {
  const missing = fields.filter((f) => typeof body?.[f] !== 'string' || !(body[f] as string).trim())
  if (missing.length) throw badRequest(`Faltan: ${missing.join(', ')}`)
  return Object.fromEntries(fields.map((f) => [f, (body![f] as string).trim()])) as Record<string, string>
}

/** Correo, documento o celular repetidos → 409, con un mensaje que la web puede mostrar tal cual. */
const assertNew = async (email: string, documento: string, telefono: string) => {
  const [dup] = await sql().query<{ email: string; document_number: string; phone: string }>(
    `select email, document_number, phone from users where lower(email) = lower($1) or document_number = $2 or phone = $3 limit 1`,
    [email, documento, telefono],
  )
  if (!dup) return
  if (dup.email?.toLowerCase() === email.toLowerCase()) throw new HttpError(409, 'Ya hay una cuenta con ese correo. Inicia sesión.')
  if (dup.document_number === documento) throw new HttpError(409, 'Ya hay una cuenta con ese documento.')
  throw new HttpError(409, 'Ya hay una cuenta con ese celular.')
}

const validPassword = (password: string) => {
  if (password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres')
  return hashSecret(password)
}

export default async function authRoutes(app: FastifyInstance) {
  /** Login con correo y contraseña (scrypt con salt). Todavía no emite sesión: la web guarda la cuenta que devuelve. */
  app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req) => {
    const email = req.body?.email?.trim()
    const password = req.body?.password ?? ''
    if (!email || !password) throw badRequest('Faltan el correo o la contraseña')
    const found = await getUserWithPassword(email)
    const ok = found?.salt && found.hash && checkSecret(password, { salt: found.salt, hash: found.hash })
    if (!found || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos')
    return sessionOf(found.user)
  })

  /**
   * Alta de un titular (quien delega): su cuenta, su wallet pública (tabla payers) y SU mandato raíz. Nunca su llave:
   * el permiso para pagar lo da después, firmando el grant en su billetera (POST /mandates/root con rootMandateId).
   */
  app.post<{ Body: Record<string, string> }>('/auth/register/titular', async (req, reply) => {
    const b = required(req.body, ['documento', 'nombre', 'apellido', 'email', 'telefono', 'password', 'walletAddress'])
    const walletAddress = b.walletAddress.startsWith('$') ? `https://${b.walletAddress.slice(1)}` : b.walletAddress
    if (!/^https:\/\/[^\s/]+\.[^\s/]+\/\S+$/.test(walletAddress)) throw badRequest('La wallet address no es válida')
    const password = validPassword(b.password)
    await assertNew(b.email, b.documento, b.telefono)
    const [taken] = await sql().query(`select 1 from payers where wallet_address = $1`, [walletAddress])
    if (taken) throw new HttpError(409, 'Esa wallet ya es de otro titular')

    // La moneda del árbol es la de su wallet. En real se lee del Test Wallet (y así se comprueba que existe).
    let asset: A.Asset = A.COP_ASSET
    if (!env.MOCK_OP) {
      try {
        asset = await getWallet(walletAddress)
      } catch {
        throw badRequest('No encontramos esa wallet en el Test Wallet')
      }
    }

    const userId = randomId('u')
    const now = new Date()
    const root: Mandate = {
      id: `root_${userId}`,
      parentId: null,
      holderType: 'person',
      holderId: userId,
      holderName: b.nombre,
      maxDebit: A.fromCop(TOPE_INICIAL_COP, asset, env.FX_COP_PER_USD),
      interval: monthly(now),
      spentInPeriod: A.zero(A.fromCop(0, asset, env.FX_COP_PER_USD)),
      periodStart: '',
      categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
      canSpend: true,
      expiresAt: new Date(now.getTime() + 365 * 24 * 3600_000).toISOString(),
      revoked: false,
      frozen: false,
      signature: '',
    }
    await sql().tx(async (tx) => {
      await insertUser(
        { id: userId, name: b.nombre, lastName: b.apellido, documentType: 'CC', documentNumber: b.documento, email: b.email.toLowerCase(), phone: b.telefono, password },
        tx,
      )
      await insertPayer({ userId, walletAddress, assetCode: asset.assetCode, assetScale: asset.assetScale }, tx)
      await putMandate(root, tx)
      await linkHolderUser(root.id, userId, tx)
    })
    reply.status(201)
    return sessionOf((await getUser(userId))!)
  })

  /**
   * Alta de un beneficiario: su cuenta, enlazada a la rama que le dio su titular (el código = id del mandato).
   * Si es la rama de un celular, también queda como dueño de la rama de la persona de la que cuelga.
   */
  app.post<{ Body: Record<string, string> }>('/auth/register/beneficiario', async (req, reply) => {
    const b = required(req.body, ['documento', 'nombre', 'email', 'telefono', 'password', 'mandateId'])
    const password = validPassword(b.password)
    const branch = await findMandate(b.mandateId)
    if (!branch || !branch.parentId) throw badRequest('Ese código no corresponde a ninguna rama. Pídeselo de nuevo a quien te delegó.')
    if (branch.revoked) throw badRequest('Esa rama está revocada')
    const [owner] = await sql().query(`select holder_user_id from mandates where id = $1`, [branch.id])
    if (owner?.holder_user_id) throw new HttpError(409, 'Esa rama ya está enlazada a otra cuenta')
    await assertNew(b.email, b.documento, b.telefono)

    const userId = randomId('u')
    await sql().tx(async (tx) => {
      await insertUser(
        { id: userId, name: b.nombre, documentType: 'CC', documentNumber: b.documento, email: b.email.toLowerCase(), phone: b.telefono, password },
        tx,
      )
      await linkHolderUser(branch.id, userId, tx)
      if (branch.holderType === 'device')
        await tx.query(`update mandates set holder_user_id = $2 where id = $1 and holder_type = 'person' and holder_user_id is null`, [
          branch.parentId,
          userId,
        ])
      // Con la cuenta ya hay celular: el modo SMS queda hablando con ese número.
      const persona = branch.holderType === 'device' ? branch.parentId : branch.holderType === 'person' ? branch.id : null
      if (persona) await linkModeProfiles(persona, tx)
    })
    reply.status(201)
    return sessionOf((await getUser(userId))!)
  })
}
