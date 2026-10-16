import type { FastifyInstance } from 'fastify'
import { amount as A, randomId, type Amount, type Category, type DeliveryAddress, type PayRequest, type Payout } from '@openroute/shared'
import {
  getAddress,
  getAgent,
  getMerchant,
  getPayment,
  getProfile,
  insertAgent,
  listMerchants,
  merchantByWallet,
  ordersFor,
  putAddress,
  upsertMerchant,
  type Agent,
} from '../db.ts'
import { emit } from '../feed/bus.ts'
import { revokeRootGrant } from '../op/grants.ts'
import { assertHolder, requireAgent } from './auth.ts'
import { issueDeviceCert, OFFLINE_START_PCT } from './devices.ts'
import { badRequest, forbidden, HttpError, notFound } from './errors.ts'
import { gatewayKey } from './keys.ts'
import {
  delegate,
  getMandate,
  remainingOf,
  restrict,
  revoke,
  ROOT_ID,
  setFrozen,
  treeOf,
  type DelegateInput,
} from './mandates.ts'
import { pay } from './pay.ts'
import { setPin } from './pin.ts'
import { sql } from '../store/sql.ts'
import { describePayout } from './payout.ts'

const CATEGORIES: Category[] = ['mercado', 'farmacia', 'efectivo', 'datos']
const isWallet = (w?: string) => /^https:\/\/\S+$/.test(w ?? '')
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default async function gatewayRoutes(app: FastifyInstance) {
  app.get('/gateway/public-key', async () => ({ publicKey: gatewayKey.publicKey }))
  app.get('/merchants', async () => listMerchants())

  // Alta de un comercio que recibe pagos: solo su wallet pública (o Puntored si no tiene). Sin variables de entorno.
  app.post<{ Body: { id?: string; name?: string; category?: Category; wallet?: string; payout?: Payout } }>(
    '/merchants',
    async (req, reply) => {
      if (req.headers['x-api-key']) throw forbidden('Un agente no puede dar de alta comercios')
      const { name, category, wallet, payout } = req.body ?? {}
      if (!name?.trim() || !category || !CATEGORIES.includes(category)) throw badRequest(`Faltan el nombre o la categoría (${CATEGORIES.join(', ')})`)
      const id = req.body?.id ?? slug(name)
      if (await getMerchant(id)) throw new HttpError(409, `Ya existe el comercio ${id}`)
      if (payout?.via === 'puntored' && !/^\d{10}$/.test(payout.llave ?? '')) throw badRequest('La llave Bre-B es un celular de 10 dígitos')
      if (payout?.via !== 'puntored' && !isWallet(wallet)) throw badRequest('Falta la wallet (https://…) o un payout por Puntored')
      const address = payout?.via === 'puntored' ? `puntored:${id}` : wallet!
      if (await merchantByWallet(address)) throw new HttpError(409, 'Esa wallet ya es de otro comercio')
      await upsertMerchant({ id, name: name.trim(), category, wallet: address, payout })
      reply.status(201)
      return getMerchant(id)
    },
  )

  // Pedidos de un comercio (pagos del Asistente con su modo de entrega): lo que el tendero debe entregar.
  app.get<{ Params: { id: string } }>('/merchants/:id/orders', async (req) => {
    const merchant = await getMerchant(req.params.id)
    if (!merchant) throw notFound('Comercio')
    return ordersFor(merchant.wallet)
  })

  // Cómo cobra el comercio: directo a su wallet o por Puntored a su llave Bre-B. Lo decide el tendero,
  // nunca un agente. Su dirección de cobro no cambia, así que los vales que ya recibió siguen valiendo.
  app.put<{ Params: { id: string }; Body: Payout }>('/merchants/:id/payout', async (req) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede cambiar cómo cobra un comercio')
    const merchant = await getMerchant(req.params.id)
    if (!merchant || merchant.isAgent) throw notFound('Comercio')
    const body = req.body
    if (body?.via === 'wallet' && isWallet(body.wallet)) merchant.payout = { via: 'wallet', wallet: body.wallet }
    else if (body?.via === 'puntored' && /^\d{10}$/.test(body.llave ?? '')) merchant.payout = { via: 'puntored', llave: body.llave }
    else throw badRequest('Use { via: "wallet", wallet: "https://…" } o { via: "puntored", llave: "<celular de 10 dígitos>" }')
    await upsertMerchant(merchant)
    await emit({
      mandateId: ROOT_ID,
      actor: { type: 'person', name: merchant.name },
      kind: 'grant',
      reason: `${merchant.name} ahora cobra ${describePayout(merchant.payout)}`,
    })
    return merchant
  })

  // Dirección de entrega del mandato raíz. La pone Juan (o quien aprobó la raíz), nunca un agente.
  app.get<{ Params: { rootId: string } }>('/delivery-address/:rootId', async (req) => getAddress(req.params.rootId))
  app.put<{ Params: { rootId: string }; Body: DeliveryAddress }>('/delivery-address/:rootId', async (req) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede cambiar la dirección de entrega')
    const root = await getMandate(req.params.rootId)
    if (root.parentId) throw badRequest('La dirección se registra en el mandato raíz')
    const recipientName = req.body?.recipientName?.trim()
    const address = req.body?.address?.trim()
    if (!recipientName || !address) throw badRequest('Faltan el nombre de quien recibe o la dirección')
    await putAddress(root.id, { recipientName, address })
    await emit({
      mandateId: root.id,
      actor: { type: 'person', name: root.holderName },
      kind: 'grant',
      reason: `Dirección de entrega: casa de ${recipientName}, ${address}`,
    })
    return getAddress(root.id)
  })

  app.get<{ Params: { id: string } }>('/mandates/:id', async (req) => ({
    ...(await getMandate(req.params.id)),
    remaining: await remainingOf(req.params.id),
  }))

  app.get<{ Params: { id: string } }>('/mandates/:id/tree', async (req) => treeOf(req.params.id))

  app.post<{ Params: { id: string }; Body: DelegateInput }>('/mandates/:id/delegate', async (req) =>
    delegate(req.params.id, req.body),
  )

  app.post<{ Params: { id: string } }>('/mandates/:id/revoke', async (req) => {
    const m = await getMandate(req.params.id)
    if (!m.parentId) await revokeRootGrant(m.id)
    const revoked = await revoke(m.id)
    await emit({
      mandateId: m.id,
      actor: { type: 'person', name: 'Juan' },
      kind: 'revoked',
      reason: `Juan revocó la rama de ${m.holderName} (${revoked.length} mandato${revoked.length > 1 ? 's' : ''})`,
    })
    return { revoked }
  })

  app.patch<{ Params: { id: string }; Body: { offlineCap?: Amount; frozen?: boolean } }>(
    '/mandates/:id/restrict',
    async (req) => restrict(req.params.id, req.body ?? {}),
  )

  app.post<{ Params: { id: string } }>('/mandates/:id/unfreeze', async (req) => {
    const m = await setFrozen(req.params.id, false)
    await emit({ mandateId: m.id, actor: { type: 'person', name: 'Juan' }, kind: 'guardian', reason: `Juan descongeló a ${m.holderName}` })
    return m
  })

  app.post<{ Params: { id: string }; Body: { publicKey: string } }>('/mandates/:id/device-key', async (req) => {
    const cert = await issueDeviceCert(req.params.id, req.body.publicKey)
    return { deviceKeyId: cert.deviceKeyId, cert, offlineCap: cert.offlineCap, gatewayPublicKey: gatewayKey.publicKey }
  })

  // Alta de un agente: una fila más. Se autentica con la credencial única del servicio de agentes + su id (x-agent-id).
  app.post<{ Body: { id?: string; name?: string; role?: Agent['role']; walletAddress?: string } }>('/agents', async (req, reply) => {
    if (req.headers['x-api-key']) throw forbidden('Un agente no puede dar de alta otros agentes')
    const { name, role, walletAddress } = req.body ?? {}
    if (!name?.trim() || !role || !['assistant', 'inventory', 'guardian'].includes(role)) throw badRequest('Faltan el nombre o el rol')
    if (walletAddress && !isWallet(walletAddress)) throw badRequest('La wallet debe ser https://…')
    const id = req.body?.id ?? slug(name)
    if (await getAgent(id)) throw new HttpError(409, `Ya existe el agente ${id}`)
    await insertAgent({ id, name: name.trim(), role, walletAddress })
    reply.status(201)
    return getAgent(id)
  })

  /**
   * Alta de un beneficiario por su titular. Siempre sale de la raíz del titular (todo el dinero sale de su cuenta):
   * crea la rama de la persona (alias, tope por periodo, PIN siempre) y la de su celular (tope sin señal). Devuelve el
   * código con el que el beneficiario enlaza su cuenta (POST /auth/register/beneficiario) y su celular.
   */
  app.post<{ Params: { id: string }; Body: { alias?: string; maxDebit?: Amount; offlineCap?: Amount; pin?: string } }>(
    '/mandates/:id/beneficiaries',
    async (req, reply) => {
      if (req.headers['x-api-key']) throw forbidden('Un agente no puede registrar beneficiarios')
      const root = await getMandate(req.params.id)
      if (root.parentId) throw badRequest('Los beneficiarios salen siempre de la raíz del titular')
      const alias = req.body?.alias?.trim()
      const { maxDebit, offlineCap, pin } = req.body ?? {}
      const positive = (a?: Amount) => !!a && /^\d+$/.test(a.value) && BigInt(a.value) > 0n && a.assetCode === root.maxDebit.assetCode
      if (!alias) throw badRequest('Falta el nombre con el que lo verás en tu panel')
      if (!positive(maxDebit)) throw badRequest(`Falta el tope por periodo (en ${root.maxDebit.assetCode})`)
      if (!positive(offlineCap)) throw badRequest(`Falta el tope sin señal (en ${root.maxDebit.assetCode})`)
      if (!/^\d{4,6}$/.test(pin ?? '')) throw badRequest('El PIN son de 4 a 6 números')

      const id = randomId('b')
      const code = await sql().tx(async (tx) => {
        const persona = await delegate(
          root.id,
          { id, holderType: 'person', holderId: id, holderName: alias, maxDebit: maxDebit!, pinThreshold: A.zero(maxDebit!) },
          tx,
        )
        const celular = await delegate(
          persona.id,
          {
            id: `${id}-cel`,
            holderType: 'device',
            holderId: `${id}-cel`,
            holderName: `Celular de ${alias}`,
            maxDebit: maxDebit!,
            // Lo que puso el titular es el techo; el celular arranca con el 40 % y el Guardián lo sube con buen uso.
            offlineCap: A.percent(offlineCap!, OFFLINE_START_PCT),
            offlineCapCeiling: offlineCap!,
          },
          tx,
        )
        await setPin(persona.id, pin!, tx)
        return celular.id
      })
      await emit({ mandateId: id, actor: { type: 'person', name: root.holderName }, kind: 'grant', amount: maxDebit, reason: `${root.holderName} registró a ${alias}` })
      reply.status(201)
      return { code, mandateId: id, deviceMandateId: code, offlineCap: A.percent(offlineCap!, OFFLINE_START_PCT), offlineCapCeiling: offlineCap }
    },
  )

  app.post<{ Body: PayRequest }>('/pay', async (req) => {
    const agent = await requireAgent(req)
    await assertHolder(agent, req.body.mandateId)
    return pay(req.body)
  })

  app.get<{ Params: { id: string } }>('/payments/:id', async (req) => {
    const p = await getPayment(req.params.id)
    if (!p) throw notFound('Pago')
    return p
  })

  // Para que el Asistente sepa quién le escribe y con qué mandatos paga.
  app.get<{ Querystring: { phone: string } }>('/sms/profile', async (req) => {
    const profile = await getProfile(req.query.phone)
    if (!profile) throw notFound('Teléfono')
    return { ...profile, deliveryAddress: await getAddress(profile.rootId) }
  })
}
