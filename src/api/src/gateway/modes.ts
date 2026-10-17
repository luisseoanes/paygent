import { amount as A, randomId, type Amount, type Mandate, type SpendMode } from '@openroute/shared'
import { insertProfile } from '../db.ts'
import { env } from '../env.ts'
import { sql, type Sql } from '../store/sql.ts'
import { OFFLINE_START_PCT } from './devices.ts'
import { badRequest } from './errors.ts'
import { chainOf, childrenOf, delegate, getMandate, putMandate, remainingOf, rollPeriod, setLimits } from './mandates.ts'
import { normalizarCelular } from './phone.ts'

/** Orden en que se reparten y se muestran. */
export const MODES: SpendMode[] = ['celular', 'asistente', 'sms']

/** Parte del tope de la persona para cada modo al habilitarlo (%). El 20 % libre deja subir uno sin bajar otro. */
const SHARE: Record<SpendMode, number> = { celular: 40, asistente: 20, sms: 20 }
/** Techo sin señal si no lo dio el titular (altas anteriores a los modos), en pesos. */
const OFFLINE_DEFAULT_COP = 50_000
/** Lo que el Asistente puede pagar al Inventario por consultas, en pesos. */
const DATOS_COP = 2_000
/** Decisión del equipo (como en la demo): el Asistente de la app pide PIN por encima de 40.000 COP. */
const PIN_ASISTENTE_COP = 40_000
/** Para buscar tiendas cercanas mientras no sepamos dónde vive la persona: Antioquia (sintético, como la demo). */
const LOCATION = { lat: 6.0, lng: -75.43 }

const SUFFIX: Record<SpendMode, string> = { celular: 'cel', asistente: 'ag', sms: 'sms' }

const pct = (a: Amount, p: number): Amount => ({ ...a, value: String((BigInt(a.value) * BigInt(p)) / 100n) })
const min = (a: Amount, b: Amount) => (A.lte(a, b) ? a : b)
const max = (a: Amount, b: Amount) => (A.lte(a, b) ? b : a)
const cop = (pesos: number, like: Amount) => A.fromCop(pesos, A.assetOf(like), env.FX_COP_PER_USD)

const free = async (persona: Mandate, conn: Sql) =>
  (await childrenOf(persona.id, conn))
    .filter((c) => !c.revoked)
    .reduce((left, c) => A.sub(left, c.maxDebit), persona.maxDebit)

/** Un id libre: el de siempre o, si ya hubo uno (revocado), otro nuevo. */
const freeId = async (base: string, conn: Sql) => ((await conn.query(`select 1 from mandates where id = $1`, [base])).length ? randomId(`${base}-`) : base)

/** El modo de una rama sin `mode`: un celular de antes de los modos, o la hoja que crea PUT /mandates/:id/sms. */
const legacyMode = (c: Mandate): SpendMode | undefined =>
  c.holderType === 'device' ? 'celular' : c.holderType === 'agent' && c.id.startsWith('sms_') ? 'sms' : undefined

/** Las ramas de modo vivas de una persona. */
export const modesOf = async (personaId: string, conn: Sql = sql()) => {
  const out = new Map<SpendMode, Mandate>()
  for (const c of await childrenOf(personaId, conn)) {
    const mode = c.mode ?? legacyMode(c)
    if (mode && !c.revoked && !out.has(mode)) out.set(mode, c)
  }
  return out
}

/** Dentro de la transacción: getProfile() iría por otra conexión. */
const profileIn = async (channel: string, conn: Sql) =>
  (await conn.query<{ user_id: string | null; mandate_id: string }>(`select user_id, mandate_id from profiles where channel = $1`, [channel]))[0]

/** Perfil del Asistente para un modo: el chat de la app (`app:<persona>`) o el número del SMS. */
const ensureProfile = async (persona: Mandate, agent: Mandate, channel: string, userId: string | null, conn: Sql) => {
  if (await profileIn(channel, conn)) {
    await conn.query(`update profiles set mandate_id = $2, data_mandate_id = $3, user_id = coalesce(user_id, $4) where channel = $1`, [
      channel,
      agent.id,
      `${agent.id}-datos`,
      userId,
    ])
    return
  }
  const rootId = (await chainOf(persona.id, conn)).at(-1)!.id
  await insertProfile(
    {
      phone: channel,
      userId: userId ?? undefined,
      name: persona.holderName,
      mandateId: agent.id,
      dataMandateId: `${agent.id}-datos`,
      location: LOCATION,
      rootId,
      chatFor: channel.startsWith('app:') ? persona.id : undefined,
    },
    conn,
  )
}

const holderOf = async (personaId: string, conn: Sql) => {
  const [r] = await conn.query<{ id: string | null; phone: string | null }>(
    `select u.id, u.phone from mandates m left join users u on u.id = m.holder_user_id where m.id = $1`,
    [personaId],
  )
  // El SMS entra en E.164: un celular guardado sin indicativo no encontraría su perfil.
  return { userId: r?.id ?? null, phone: (r?.phone && normalizarCelular(r.phone)) || null }
}

/**
 * Habilita los modos que le falten a una persona, repartiendo lo que queda libre de su tope (SHARE). Con un celular de
 * antes de los modos que ocupa todo el tope, primero lo baja a su parte. Idempotente: los modos vivos no se tocan.
 */
export const enableModes = async (personaId: string, opts: { offlineCap?: Amount } = {}, conn: Sql = sql()) => {
  const persona = await getMandate(personaId, conn)
  if (persona.holderType !== 'person' || !persona.parentId) throw new Error(`${personaId} no es la rama de una persona`)
  const have = await modesOf(persona.id, conn)
  const M = persona.maxDebit
  const created: SpendMode[] = []

  // Alta anterior a los modos: el celular se quedó con todo el tope y no tiene `mode`.
  const legacy = have.get('celular')
  if (legacy && !legacy.mode) {
    const ceiling = legacy.offlineCapCeiling ?? legacy.offlineCap ?? A.zero(M)
    const floor = max(max(pct(M, SHARE.celular), ceiling), legacy.spentInPeriod)
    await putMandate({ ...legacy, mode: 'celular', maxDebit: min(legacy.maxDebit, floor) }, conn)
  }

  for (const mode of MODES.filter((m) => !have.has(m))) {
    const left = await free(persona, conn)
    const id = await freeId(`${persona.id}-${SUFFIX[mode]}`, conn)
    if (mode === 'celular') {
      // Lo que pone el titular es el techo; el celular arranca con el 40 % y el Guardián lo mueve con el uso.
      const ceiling = min(opts.offlineCap ?? cop(OFFLINE_DEFAULT_COP, M), left)
      const share = min(max(pct(M, SHARE.celular), ceiling), left)
      await delegate(
        persona.id,
        {
          id,
          mode,
          holderType: 'device',
          holderId: id,
          holderName: `Celular de ${persona.holderName}`,
          maxDebit: share,
          offlineCap: A.percent(ceiling, OFFLINE_START_PCT),
          offlineCapCeiling: ceiling,
        },
        conn,
      )
    } else {
      // El Asistente paga como agente: el gateway solo le deja usar ramas de las que él es titular.
      const share = min(pct(M, SHARE[mode]), left)
      const agent = await delegate(
        persona.id,
        {
          id,
          mode,
          holderType: 'agent',
          holderId: 'asistente',
          holderName: mode === 'sms' ? `SMS de ${persona.holderName}` : `Asistente de ${persona.holderName}`,
          maxDebit: share,
          // Por SMS el remitente se puede suplantar: PIN en cada compra.
          pinThreshold: mode === 'sms' ? A.zero(M) : min(cop(PIN_ASISTENTE_COP, M), share),
        },
        conn,
      )
      if (persona.categories.includes('datos'))
        await delegate(
          agent.id,
          {
            id: `${agent.id}-datos`,
            holderType: 'agent',
            holderId: 'asistente',
            holderName: `${agent.holderName} → Inventario`,
            maxDebit: min(cop(DATOS_COP, M), share),
            categories: ['datos'],
          },
          conn,
        )
    }
    created.push(mode)
  }

  await linkModeProfiles(persona.id, conn)
  return created
}

/**
 * Enlaza los modos del Asistente con sus canales: el chat de la app siempre; el SMS cuando la persona ya tiene cuenta
 * con celular (se llama también al enlazar la cuenta del beneficiario).
 */
export const linkModeProfiles = async (personaId: string, conn: Sql = sql()) => {
  const persona = await getMandate(personaId, conn)
  const modes = await modesOf(personaId, conn)
  const { userId, phone } = await holderOf(personaId, conn)
  const chat = modes.get('asistente')
  if (chat) await ensureProfile(persona, chat, `app:${persona.id}`, userId, conn)
  const sms = modes.get('sms')
  const owner = phone ? await profileIn(phone, conn) : undefined
  // Un número que ya habla con otra persona (la demo) no se pisa.
  if (sms && phone && (!owner || owner.user_id === userId)) {
    const channels = (await conn.query<{ channel: string }>(`select channel from profiles where mandate_id = $1 and chat_for is null`, [sms.id])).map(
      (r) => r.channel,
    )
    // El mismo número guardado sin indicativo se cambia por el bueno; otro número lo eligió el titular y se respeta.
    for (const raw of channels.filter((c) => c !== phone && normalizarCelular(c) === phone))
      await conn.query(`delete from profiles where channel = $1`, [raw])
    if (!channels.some((c) => normalizarCelular(c) !== phone)) await ensureProfile(persona, sms, phone, userId, conn)
  }
}

export interface ModeView {
  mode: SpendMode
  mandateId: string
  maxDebit: Amount
  /** Lo mínimo que puede tener: lo que ya repartió a sus propias ramas (la consulta al Inventario) */
  minDebit: Amount
  spent: Amount
  remaining: Amount
  offlineCap?: Amount
  /** Techo sin señal que fijó el titular */
  offlineCapCeiling?: Amount
  pinThreshold?: Amount
  frozen: boolean
  /** Por dónde se usa: el número del SMS si ya está enlazado */
  phone?: string
}

const sumOf = (ms: Mandate[], like: Amount) => ms.filter((c) => !c.revoked).reduce((acc, c) => A.add(acc, c.maxDebit), A.zero(like))

/**
 * Los modos vivos de la persona dueña de `id` (la persona o cualquiera de sus ramas de modo), con lo que hace falta
 * para repartir su tope: `budget` (el de la persona) y `reserved` (lo que tienen sus otras ramas, que no son modos).
 */
export const listModes = async (id: string) => {
  const m = await getMandate(id)
  const personaId = m.holderType === 'person' ? m.id : m.parentId!
  const persona = m.id === personaId ? m : await getMandate(personaId)
  const modes = await modesOf(personaId)
  // El número con el que habla su hoja SMS (el de la cuenta o el que eligió el titular).
  const smsLeaf = modes.get('sms')
  const [sms] = smsLeaf
    ? await sql().query<{ channel: string }>(`select channel from profiles where mandate_id = $1 and chat_for is null limit 1`, [smsLeaf.id])
    : []
  const modeIds = new Set([...modes.values()].map((b) => b.id))
  const reserved = sumOf((await childrenOf(personaId)).filter((c) => !modeIds.has(c.id)), persona.maxDebit)
  const views: ModeView[] = []
  for (const mode of MODES) {
    const b = modes.get(mode)
    if (!b) continue
    views.push({
      mode,
      mandateId: b.id,
      maxDebit: b.maxDebit,
      minDebit: sumOf(await childrenOf(b.id), b.maxDebit),
      spent: rollPeriod(b).spentInPeriod,
      remaining: await remainingOf(b.id),
      offlineCap: b.offlineCap,
      offlineCapCeiling: b.offlineCapCeiling,
      pinThreshold: b.pinThreshold,
      frozen: b.frozen,
      phone: mode === 'sms' ? sms?.channel : undefined,
    })
  }
  // Hasta dónde puede subir la persona: el tope de su padre menos lo que tienen sus hermanos.
  const parent = await getMandate(persona.parentId!)
  const siblings = (await childrenOf(parent.id)).filter((c) => c.id !== persona.id)
  const budgetMax = A.sub(parent.maxDebit, sumOf(siblings, persona.maxDebit))
  return { personaId, personaName: persona.holderName, budget: persona.maxDebit, budgetMax, reserved, modes: views }
}

/**
 * El titular reparte de una vez el tope de la persona entre sus modos, y puede cambiar ese tope (`budget`). Todo o
 * nada, en un orden en que la suma nunca pasa del padre a mitad de camino: si la persona sube, sube primero; si baja,
 * baja al final; entre medias, los modos bajan antes de subir.
 */
export const setModeLimits = async (
  personaId: string,
  limits: { mandateId: string; maxDebit?: Amount; offlineCap?: Amount }[],
  budget?: Amount,
) =>
  sql().tx(async (tx) => {
    const own = new Set([...(await modesOf(personaId, tx)).values()].map((b) => b.id))
    const ajenos = limits.filter((l) => !own.has(l.mandateId))
    if (ajenos.length) throw badRequest(`No son modos de esta persona: ${ajenos.map((l) => l.mandateId).join(', ')}`)
    const persona = await getMandate(personaId, tx)
    const sube = !!budget && !A.lte(budget, persona.maxDebit)
    const changed: Mandate[] = []
    if (budget && sube) changed.push(await setLimits(personaId, { maxDebit: budget }, tx))
    const current = new Map((await childrenOf(personaId, tx)).map((c) => [c.id, c]))
    const baja = (l: (typeof limits)[number]) => !l.maxDebit || A.lte(l.maxDebit, current.get(l.mandateId)!.maxDebit)
    const ordered = [...limits.filter(baja), ...limits.filter((l) => !baja(l))]
    for (const l of ordered) changed.push(await setLimits(l.mandateId, { maxDebit: l.maxDebit, offlineCap: l.offlineCap }, tx))
    if (budget && !sube && !A.lte(persona.maxDebit, budget)) changed.push(await setLimits(personaId, { maxDebit: budget }, tx))
    return changed
  })
