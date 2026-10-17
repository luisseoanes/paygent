import type { Category, Merchant, Payout } from '@openroute/shared'
import { getMerchant, merchantByWallet, upsertMerchant } from '../store/merchants.ts'
import { emit } from '../feed/bus.ts'
import { paymentsTo } from '../store/payments.ts'
import { badRequest, HttpError, notFound } from '../gateway/errors.ts'
import { DEMO_ROOT_ID } from '../demo/constants.ts'
import { describePayout } from '../gateway/payout.ts'

// Quien solo recibe: comercios con su wallet pública o, sin wallet, cobro por Puntored a su llave Bre-B.

export const CATEGORIES: Category[] = ['mercado', 'farmacia', 'efectivo', 'datos']
export const isWallet = (w?: string) => /^https:\/\/\S+$/.test(w ?? '')
const isLlave = (l?: string) => /^\d{10}$/.test(l ?? '')

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export interface NewMerchant {
  id?: string
  name?: string
  category?: Category
  wallet?: string
  payout?: Payout
}

/** Alta de un comercio a nombre de la cuenta que lo registra (su tendero). */
export const registerMerchant = async (body: NewMerchant, ownerUserId: string) => {
  const { name, category, wallet, payout } = body
  if (!name?.trim() || !category || !CATEGORIES.includes(category)) throw badRequest(`Faltan el nombre o la categoría (${CATEGORIES.join(', ')})`)
  const id = body.id ?? slug(name)
  if (await getMerchant(id)) throw new HttpError(409, `Ya existe el comercio ${id}`)
  if (payout?.via === 'puntored' && !isLlave(payout.llave)) throw badRequest('La llave Bre-B es un celular de 10 dígitos')
  if (payout?.via !== 'puntored' && !isWallet(wallet)) throw badRequest('Falta la wallet (https://…) o un payout por Puntored')
  const address = payout?.via === 'puntored' ? `puntored:${id}` : wallet!
  if (await merchantByWallet(address)) throw new HttpError(409, 'Esa wallet ya es de otro comercio')
  await upsertMerchant({ id, name: name.trim(), category, wallet: address, payout, ownerUserId })
  return getMerchant(id)
}

/** Cómo cobra el comercio. Su dirección de cobro no cambia, así que los vales que ya recibió siguen valiendo. */
/** Lo que recibió el comercio: vales liquidados y compras del Asistente, con lo que llegó en su moneda. */
export const merchantPayments = async (merchantId: string) => {
  const merchant = await getMerchant(merchantId)
  if (!merchant) throw notFound('Comercio')
  return (await paymentsTo(merchant.wallet)).map((p) => ({ ...p, received: p.receiveAmount ?? p.price ?? p.amount }))
}

export const setPayout = async (merchantId: string, body?: Payout): Promise<Merchant> => {
  const merchant = await getMerchant(merchantId)
  if (!merchant || merchant.isAgent) throw notFound('Comercio')
  if (body?.via === 'wallet' && isWallet(body.wallet)) merchant.payout = { via: 'wallet', wallet: body.wallet }
  else if (body?.via === 'puntored' && isLlave(body.llave)) merchant.payout = { via: 'puntored', llave: body.llave }
  else throw badRequest('Use { via: "wallet", wallet: "https://…" } o { via: "puntored", llave: "<celular de 10 dígitos>" }')
  await upsertMerchant(merchant)
  // El comercio no cuelga de ningún árbol: su aviso va al feed de la demo.
  await emit({ mandateId: DEMO_ROOT_ID, actor: { type: 'person', name: merchant.name }, kind: 'grant', reason: `${merchant.name} ahora cobra ${describePayout(merchant.payout)}` })
  return merchant
}
