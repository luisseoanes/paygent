import type { FastifyInstance, FastifyRequest } from 'fastify'
import { amount as A, monthly, randomId, type Category, type Mandate } from '@openroute/shared'
import {
  branchesOfUser,
  findDuplicateUser,
  getPayer,
  getUser,
  getUserWithPassword,
  insertPayer,
  insertUser,
  rootOfUser,
  walletTaken,
  type User,
} from '../store/accounts.ts'
import { env } from '../env.ts'
import { fxRate } from '../fx/trm.ts'
import { HttpError, badRequest } from '../gateway/errors.ts'
import { findMandate, linkHolderUser, putMandate } from '../gateway/mandates.ts'
import { linkModeProfiles } from '../gateway/modes.ts'
import { checkSecret, hashSecret } from '../gateway/pin.ts'
import { getWallet } from '../op/client.ts'
import { holderUserOf, linkPersonIfFree, lockMandates } from '../store/mandates.ts'
import { shopOfUser } from '../store/merchants.ts'
import { freeMerchantId, isWallet, llaveBreB, registerMerchant } from '../merchants/registry.ts'
import { sql } from '../store/sql.ts'
import { loginBloqueado, loginCorrecto, loginFallido } from './limiter.ts'
import { issueToken } from './session.ts'

/** Lo que es una cuenta: quien delega (titular), quien recibe una delegación (beneficiario) o quien cobra (tendero). */
export type Rol = 'titular' | 'beneficiario' | 'tendero'

/** Tope inicial de la raíz de un titular nuevo, en pesos. Al firmar en su billetera queda el que él apruebe. */
const TOPE_INICIAL_COP = 1_200_000

/** La cuenta con lo que necesita la web (misma forma que su tipo User) y su rol. */
const sessionOf = async (user: User) => {
  const payer = await getPayer(user.id)
  const root = await rootOfUser(user.id)
  // Primero la del celular: es la que enlaza la billetera (/billetera la usa como código).
  const branches = await branchesOfUser(user.id)
  const shop = await shopOfUser(user.id)
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
    rootMandateId: root ?? null,
    mandateId: branches[0] ?? null,
    mandateIds: branches,
    merchantId: shop ?? null,
    user,
    /** Va en Authorization: Bearer en todo lo que solo decide esta cuenta. */
    token: issueToken(user.id),
  }
}

const required = (body: Record<string, unknown> | undefined, fields: string[]) => {
  const missing = fields.filter((f) => typeof body?.[f] !== 'string' || !(body[f] as string).trim())
  if (missing.length) throw badRequest(`Faltan: ${missing.join(', ')}`)
  return Object.fromEntries(fields.map((f) => [f, (body![f] as string).trim()])) as Record<string, string>
}

/** Correo, documento o celular repetidos → 409, con un mensaje que la web puede mostrar tal cual. */
const assertNew = async (email: string, documento: string, telefono: string) => {
  const dup = await findDuplicateUser(email, documento, telefono)
  if (!dup) return
  if (dup.email?.toLowerCase() === email.toLowerCase()) throw new HttpError(409, 'Ya hay una cuenta con ese correo. Inicia sesión.')
  if (dup.document_number === documento) throw new HttpError(409, 'Ya hay una cuenta con ese documento.')
  throw new HttpError(409, 'Ya hay una cuenta con ese celular.')
}

const validPassword = async (password: string) => {
  if (password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres')
  return hashSecret(password)
}

/** Quién intenta entrar: la IP del cliente (primer salto de x-forwarded-for tras el proxy de la web) y el correo. */
const loginKey = (req: FastifyRequest, email: string) => {
  const xff = req.headers['x-forwarded-for']
  const ip = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() || req.ip
  return `${ip}|${email.toLowerCase()}`
}

export default async function authRoutes(app: FastifyInstance) {
  /** Login con correo y contraseña (scrypt con salt). Devuelve la cuenta con su token de sesión. */
  app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req) => {
    const email = req.body?.email?.trim()
    const password = req.body?.password ?? ''
    if (!email || !password) throw badRequest('Faltan el correo o la contraseña')
    const key = loginKey(req, email)
    if (loginBloqueado(key)) throw new HttpError(429, 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.')
    const found = await getUserWithPassword(email)
    const ok = !!found?.salt && !!found.hash && (await checkSecret(password, { salt: found.salt, hash: found.hash }))
    if (!found || !ok) {
      loginFallido(key)
      throw new HttpError(401, 'Correo o contraseña incorrectos')
    }
    loginCorrecto(key)
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
    const password = await validPassword(b.password)
    await assertNew(b.email, b.documento, b.telefono)
    if (await walletTaken(walletAddress)) throw new HttpError(409, 'Esa wallet ya es de otro titular')

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
      maxDebit: A.fromCop(TOPE_INICIAL_COP, asset, fxRate()),
      interval: monthly(now),
      spentInPeriod: A.zero(A.fromCop(0, asset, fxRate())),
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
   * Alta de un tendero: su cuenta y su tienda, en una sola transacción. Sin wallet cobra por Puntored a su llave
   * Bre-B (por defecto, su celular); con `wallet` cobra directo en ella. Desde ya puede recibir vales y pagos.
   */
  app.post<{ Body: Record<string, string> }>('/auth/register/tendero', async (req, reply) => {
    const b = required(req.body, ['documento', 'nombre', 'email', 'telefono', 'password', 'tienda', 'categoria'])
    const password = await validPassword(b.password)
    const raw = req.body ?? {}
    const wallet = raw.wallet?.trim() ? (raw.wallet.trim().startsWith('$') ? `https://${raw.wallet.trim().slice(1)}` : raw.wallet.trim()) : undefined
    if (wallet && !isWallet(wallet)) throw badRequest('La wallet address no es válida')
    const llave = wallet ? undefined : llaveBreB(raw.llave?.trim() || b.telefono)
    if (!wallet && !llave) throw badRequest('La llave Bre-B es un celular colombiano de 10 dígitos (ej. 310 555 0101)')
    await assertNew(b.email, b.documento, b.telefono)

    const userId = randomId('u')
    await sql().tx(async (tx) => {
      await insertUser(
        { id: userId, name: b.nombre, lastName: raw.apellido?.trim() || undefined, documentType: 'CC', documentNumber: b.documento, email: b.email.toLowerCase(), phone: b.telefono, password },
        tx,
      )
      await registerMerchant(
        {
          id: await freeMerchantId(b.tienda, tx),
          name: b.tienda,
          category: b.categoria as Category,
          wallet,
          payout: wallet ? { via: 'wallet', wallet } : { via: 'puntored', llave: llave! },
        },
        userId,
        tx,
      )
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
    const password = await validPassword(b.password)
    const branch = await findMandate(b.mandateId)
    if (!branch || !branch.parentId) throw badRequest('Ese código no corresponde a ninguna rama. Pídeselo de nuevo a quien te delegó.')
    if (branch.revoked) throw badRequest('Esa rama está revocada')
    if (await holderUserOf(branch.id)) throw new HttpError(409, 'Esa rama ya está enlazada a otra cuenta')
    await assertNew(b.email, b.documento, b.telefono)

    const userId = randomId('u')
    await sql().tx(async (tx) => {
      // Otra alta simultánea con el mismo código pudo reclamarla: se vuelve a mirar con la rama bloqueada.
      await lockMandates([branch.id], tx)
      if (await holderUserOf(branch.id, tx)) throw new HttpError(409, 'Esa rama ya está enlazada a otra cuenta')
      await insertUser(
        { id: userId, name: b.nombre, documentType: 'CC', documentNumber: b.documento, email: b.email.toLowerCase(), phone: b.telefono, password },
        tx,
      )
      await linkHolderUser(branch.id, userId, tx)
      if (branch.holderType === 'device')
        await linkPersonIfFree(branch.parentId!, userId, tx)
      // Con la cuenta ya hay celular: el modo SMS queda hablando con ese número.
      const persona = branch.holderType === 'device' ? branch.parentId : branch.holderType === 'person' ? branch.id : null
      if (persona) await linkModeProfiles(persona, tx)
    })
    reply.status(201)
    return sessionOf((await getUser(userId))!)
  })
}
