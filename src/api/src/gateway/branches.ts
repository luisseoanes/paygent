import { amount as A, randomId, type Amount, type DeliveryAddress } from '@openroute/shared'
import { getAddress, putAddress } from '../store/profiles.ts'
import { emit } from '../feed/bus.ts'
import { revokeRootGrant } from '../op/grants.ts'
import { sql } from '../store/sql.ts'
import { badRequest, forbidden } from './errors.ts'
import { chainOf, delegate, getMandate, restrict, revoke, setFrozen, setLimits, type DelegateInput } from './mandates.ts'
import { enableModes, listModes, setModeLimits } from './modes.ts'
import { setPin } from './pin.ts'
import { activarSms, desactivarSms, enmascarar } from './sms-canal.ts'

// Casos de uso del titular sobre su árbol: cada uno valida, cambia el árbol en una transacción y deja su línea en el
// feed. Las rutas solo autentican y traducen HTTP (gateway/routes/).

/** Nombre del titular dueño de la raíz de la rama (para el feed). */
const titularDe = async (mandateId: string) => (await chainOf(mandateId)).at(-1)!.holderName
const person = (name: string) => ({ type: 'person' as const, name })

export const delegateBranch = async (parentId: string, input: DelegateInput) => sql().tx((tx) => delegate(parentId, input, tx))

/** Revoca la rama y todo lo que cuelga de ella. En la raíz también revoca el grant en la billetera. */
export const revokeBranch = async (id: string) => {
  const m = await getMandate(id)
  const titular = await titularDe(id)
  if (!m.parentId) await revokeRootGrant(m.id)
  const revoked = await revoke(m.id)
  const n = revoked.length
  await emit({ mandateId: m.id, actor: person(titular), kind: 'revoked', reason: `${titular} revocó la rama de ${m.holderName} (${n} mandato${n > 1 ? 's' : ''})` })
  return revoked
}

export const unfreezeBranch = async (id: string) => {
  const m = await setFrozen(id, false)
  const titular = await titularDe(id)
  await emit({ mandateId: m.id, actor: person(titular), kind: 'guardian', reason: `${titular} descongeló a ${m.holderName}` })
  return m
}

export const restrictBranch = restrict

/** La dirección de entrega del árbol: la registra el titular en su raíz y el gateway la pone en cada pedido. */
export const setDeliveryAddress = async (rootId: string, body: Partial<DeliveryAddress>) => {
  const root = await getMandate(rootId)
  if (root.parentId) throw badRequest('La dirección se registra en el mandato raíz')
  const recipientName = body.recipientName?.trim()
  const address = body.address?.trim()
  if (!recipientName || !address) throw badRequest('Faltan el nombre de quien recibe o la dirección')
  await putAddress(root.id, { recipientName, address })
  await emit({ mandateId: root.id, actor: person(root.holderName), kind: 'grant', reason: `Dirección de entrega: casa de ${recipientName}, ${address}` })
  return getAddress(root.id)
}

export interface NewBeneficiary {
  alias?: string
  maxDebit?: Amount
  offlineCap?: Amount
  pin?: string
}

/**
 * Alta de un beneficiario: siempre sale de la raíz (todo el dinero sale de la cuenta del titular). Crea la rama de la
 * persona, su PIN y todos sus modos; el código de enlace es la rama del celular.
 */
export const registerBeneficiary = async (rootId: string, body: NewBeneficiary) => {
  const root = await getMandate(rootId)
  if (root.parentId) throw badRequest('Los beneficiarios salen siempre de la raíz del titular')
  const alias = body.alias?.trim()
  const { maxDebit, offlineCap, pin } = body
  const positive = (a?: Amount) =>
    !!a && /^\d+$/.test(a.value) && BigInt(a.value) > 0n && a.assetCode === root.maxDebit.assetCode && a.assetScale === root.maxDebit.assetScale
  if (!alias) throw badRequest('Falta el nombre con el que lo verás en tu panel')
  if (!positive(maxDebit)) throw badRequest(`Falta el tope por periodo (en ${root.maxDebit.assetCode})`)
  if (!positive(offlineCap)) throw badRequest(`Falta el tope sin señal (en ${root.maxDebit.assetCode})`)
  if (!A.lte(offlineCap!, maxDebit!)) throw badRequest('El tope sin señal no puede superar el tope por periodo')
  if (!/^\d{4,6}$/.test(pin ?? '')) throw badRequest('El PIN son de 4 a 6 números')

  const id = randomId('b')
  await sql().tx(async (tx) => {
    await delegate(root.id, { id, holderType: 'person', holderId: id, holderName: alias, maxDebit: maxDebit!, pinThreshold: A.zero(maxDebit!) }, tx)
    await setPin(id, pin!, tx)
    await enableModes(id, { offlineCap }, tx)
  })
  const { modes } = await listModes(id)
  const celular = modes.find((m) => m.mode === 'celular')!
  await emit({ mandateId: id, actor: person(root.holderName), kind: 'grant', amount: maxDebit, reason: `${root.holderName} registró a ${alias}` })
  return { code: celular.mandateId, mandateId: id, deviceMandateId: celular.mandateId, modes, offlineCap: celular.offlineCap, offlineCapCeiling: offlineCap }
}

const personBranch = async (id: string) => {
  const persona = await getMandate(id)
  if (persona.holderType !== 'person' || !persona.parentId) throw badRequest('Los modos son de la rama de una persona')
  return persona
}

/** Vuelve a habilitar los modos que falten (revocados o altas anteriores a los modos). */
export const enableBranchModes = async (id: string) => {
  const persona = await personBranch(id)
  if (persona.revoked) throw forbidden('La rama está revocada')
  const created = await sql().tx((tx) => enableModes(persona.id, {}, tx))
  if (created.length)
    await emit({ mandateId: persona.id, actor: person(await titularDe(persona.id)), kind: 'grant', reason: `${persona.holderName} ya puede pagar por: ${created.join(', ')}` })
  return { created, ...(await listModes(persona.id)) }
}

/** Reparte de una vez el tope de la persona entre sus modos (los sliders). Todo o nada. */
export const splitModes = async (id: string, body: { budget?: Amount; limits?: { mandateId: string; maxDebit?: Amount; offlineCap?: Amount }[] }) => {
  const persona = await personBranch(id)
  const limits = body.limits ?? []
  if (!limits.length && !body.budget) throw badRequest('Faltan los topes (limits) o el tope de la persona (budget)')
  const changed = await setModeLimits(persona.id, limits, body.budget)
  await emit({
    mandateId: persona.id,
    actor: person(await titularDe(persona.id)),
    kind: 'grant',
    reason: `Nuevo reparto de ${persona.holderName}: ${changed.map((m) => `${m.holderName} ${A.format(m.maxDebit)}`).join(', ')}`,
  })
  return listModes(persona.id)
}

/** Sube o baja el tope de una rama dentro de su padre. El bloqueo del padre dura hasta guardar. */
export const changeLimits = async (id: string, patch: { maxDebit?: Amount; offlineCap?: Amount }) => {
  if (!patch.maxDebit && !patch.offlineCap) throw badRequest('Falta el tope nuevo (maxDebit u offlineCap)')
  const m = await sql().tx((tx) => setLimits(id, patch, tx))
  await emit({
    mandateId: m.id,
    actor: person(await titularDe(m.id)),
    kind: 'grant',
    amount: m.maxDebit,
    reason: `Nuevo tope de ${m.holderName}: ${A.format(m.maxDebit)}${m.offlineCap ? `, sin señal ${A.format(m.offlineCap)}` : ''}`,
  })
  return m
}

export const turnOnSms = async (id: string, body: { phone?: string; pin?: string }) => {
  const { rama, estado } = await activarSms(id, body)
  const titular = await titularDe(rama.id)
  await emit({ mandateId: rama.id, actor: person(titular), kind: 'grant', reason: `${titular} activó el SMS de ${rama.holderName} (${estado.phone})` })
  return estado
}

export const turnOffSms = async (id: string) => {
  const { phone, mandateId } = await desactivarSms(id)
  const chain = await chainOf(id)
  const titular = chain.at(-1)!.holderName
  await emit({ mandateId, actor: person(titular), kind: 'revoked', reason: `${titular} apagó el SMS de ${chain[0].holderName} (${enmascarar(phone)})` })
  return { active: false }
}
