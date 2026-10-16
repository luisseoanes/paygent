import { amount as A, randomId, type Mandate } from '@openroute/shared'
import { insertProfile, type PhoneProfile } from '../db.ts'
import { env } from '../env.ts'
import { sql, type Row, type Sql } from '../store/sql.ts'
import { badRequest, HttpError, notFound } from './errors.ts'
import { chainOf, childrenOf, delegate, revoke, type DelegateInput } from './mandates.ts'
import { modesOf } from './modes.ts'
import { setPin } from './pin.ts'

// Canal SMS de una rama: un número de celular habla con el Asistente, que paga con una hoja de esa rama.

/** El agente que atiende los SMS (fila de la tabla agents, x-agent-id del servicio Python). */
export const ASISTENTE_ID = 'asistente'
/** Ubicación por defecto del perfil: la zona de la demo, con comercios precargados en el Inventario. */
export const UBICACION_POR_DEFECTO = { lat: 6.0, lng: -75.43 }
/** Tope de las consultas del Asistente al Agente de Inventario, en pesos. */
const TOPE_DATOS_COP = 2000

/** Celular → E.164. Sin indicativo se asume Colombia (3XX XXX XXXX). */
export const normalizarCelular = (raw: string): string | null => {
  const d = (raw ?? '').replace(/[\s\-().]/g, '')
  if (/^3\d{9}$/.test(d)) return `+57${d}`
  if (/^573\d{9}$/.test(d)) return `+${d}`
  if (/^\+[1-9]\d{7,14}$/.test(d)) return d
  return null
}

/** Motivo por el que el PIN no sirve, o null. 4 números (el Asistente solo reconoce 4) y nada obvio. */
export const pinSmsInvalido = (pin?: string): string | null => {
  if (!/^\d{4}$/.test(pin ?? '')) return 'El PIN son exactamente 4 números'
  const d = [...pin!].map(Number)
  const paso = d[1] - d[0]
  if (Math.abs(paso) <= 1 && d.every((n, i) => i === 0 || n - d[i - 1] === paso)) return 'Ese PIN es muy fácil de adivinar'
  return null
}

export const enmascarar = (e164: string) => `${e164.startsWith('+57') ? '+57 ' : ''}••• ••• ${e164.slice(-4)}`

export interface CanalSms {
  phone: string
  pin: string
  name: string
  userId?: string
  location?: PhoneProfile['location']
  /** La hoja del Asistente; por defecto PIN en cada compra */
  asistente: Partial<DelegateInput> & Pick<DelegateInput, 'maxDebit'>
  /** La hoja con la que el Asistente paga al Inventario */
  datos?: Partial<DelegateInput>
}

/** Crea la hoja del Asistente bajo `fromId`, su hoja de datos, el PIN (con hash) y el perfil del número. */
export const conectarSms = async (fromId: string, c: CanalSms, tx: Sql) => {
  const chain = await chainOf(fromId, tx)
  const asistente = await delegate(
    fromId,
    {
      id: randomId('sms_'),
      holderType: 'agent',
      holderId: ASISTENTE_ID,
      holderName: `Asistente de ${c.name}`,
      pinThreshold: A.zero(c.asistente.maxDebit),
      ...c.asistente,
    },
    tx,
  )
  const datos = await delegate(
    asistente.id,
    {
      id: `${asistente.id}-datos`,
      holderType: 'agent',
      holderId: ASISTENTE_ID,
      holderName: `${asistente.holderName} → Inventario`,
      maxDebit: A.fromCop(TOPE_DATOS_COP, A.assetOf(asistente.maxDebit), env.FX_COP_PER_USD),
      categories: ['datos'],
      ...c.datos,
    },
    tx,
  )
  await setPin(asistente.id, c.pin, tx)
  await insertProfile(
    {
      phone: c.phone,
      userId: c.userId,
      name: c.name,
      mandateId: asistente.id,
      dataMandateId: datos.id,
      location: c.location ?? UBICACION_POR_DEFECTO,
      rootId: chain.at(-1)!.id,
    },
    tx,
  )
  return { mandateId: asistente.id, dataMandateId: datos.id }
}

/** El perfil SMS activo de una rama (su hoja del Asistente sin revocar). Desde un celular, también el de su persona. */
const perfilDe = async (branchId: string, conn: Sql = sql()) => {
  const [r] = await conn.query<Row>(
    `select p.channel, p.mandate_id from profiles p join mandates m on m.id = p.mandate_id
     where m.parent_id in (select $1 union select parent_id from mandates where id = $1 and holder_type = 'device')
       and not m.revoked and p.chat_for is null
     order by m.parent_id = $1 desc limit 1`,
    [branchId],
  )
  return r ? { phone: r.channel as string, mandateId: r.mandate_id as string } : undefined
}

export const estadoSms = async (branchId: string) => {
  const p = await perfilDe(branchId)
  return p ? { active: true, phone: enmascarar(p.phone), mandateId: p.mandateId } : { active: false }
}

const ramaConSms = (chain: Mandate[]) => {
  const [rama] = chain
  if (!rama.parentId) throw badRequest('El SMS se activa en una rama que delegaste, no en tu raíz')
  if (rama.revoked) throw badRequest('Esa rama está revocada')
  if (rama.holderType === 'agent') throw badRequest('Un agente no recibe SMS: actívalo en la rama de la persona o de su celular')
  return rama
}

/** Activa (o cambia número y PIN de) el SMS de una rama. Devuelve el estado y a quién avisar en el feed. */
export const activarSms = async (branchId: string, body: { phone?: string; pin?: string }) => {
  const phone = normalizarCelular(body.phone ?? '')
  if (!phone) throw badRequest('Ese no parece un celular (ej. 300 111 2233)')
  const motivo = pinSmsInvalido(body.pin)
  if (motivo) throw badRequest(motivo)

  const rama = await sql().tx(async (tx) => {
    const chain = await chainOf(branchId, tx)
    const rama = ramaConSms(chain)
    const actual = await perfilDe(rama.id, tx)
    // Persona con el modo SMS ya habilitado (al darla de alta): se conecta esa hoja, no se crea otra.
    const persona = rama.holderType === 'device' && chain[1]?.parentId ? chain[1] : rama
    const modo = actual ? undefined : (await modesOf(persona.id, tx)).get('sms')
    const [ocupado] = await tx.query<Row>(`select mandate_id from profiles where channel = $1`, [phone])
    if (ocupado && ocupado.mandate_id !== (actual?.mandateId ?? modo?.id)) throw new HttpError(409, 'Ese número ya habla con el Asistente desde otra rama')

    if (modo) {
      const [previo] = await tx.query<Row>(`select channel from profiles where mandate_id = $1`, [modo.id])
      if (previo) await tx.query(`update profiles set channel = $1 where channel = $2`, [phone, previo.channel])
      else {
        const [dueño] = await tx.query<Row>(`select holder_user_id from mandates where id = $1`, [persona.id])
        await insertProfile(
          {
            phone,
            userId: dueño?.holder_user_id ?? undefined,
            name: persona.holderName,
            mandateId: modo.id,
            dataMandateId: `${modo.id}-datos`,
            location: UBICACION_POR_DEFECTO,
            rootId: chain.at(-1)!.id,
          },
          tx,
        )
      }
      await setPin(modo.id, body.pin!, tx)
      return persona
    }
    if (actual) {
      await tx.query(`update profiles set channel = $1 where channel = $2`, [phone, actual.phone])
      await setPin(actual.mandateId, body.pin!, tx)
      return rama
    }
    // La hoja del Asistente se lleva el cupo que la rama aún no repartió (monotonía: suma de hijos ≤ padre).
    const repartido = (await childrenOf(rama.id, tx))
      .filter((h) => !h.revoked)
      .reduce((acc, h) => A.add(acc, h.maxDebit), A.zero(rama.maxDebit))
    const libre = A.sub(rama.maxDebit, repartido)
    if (A.toCop(libre, env.FX_COP_PER_USD) <= TOPE_DATOS_COP)
      throw new HttpError(409, `${rama.holderName} ya repartió todo su cupo. Actívalo en la rama que lo tiene (su celular).`)
    if (!rama.categories.includes('datos')) throw badRequest('La rama necesita la categoría datos para que el Asistente consulte precios')

    const [dueño] = await tx.query<Row>(`select holder_user_id from mandates where id = $1`, [persona.id])
    await conectarSms(rama.id, { phone, pin: body.pin!, name: persona.holderName, userId: dueño?.holder_user_id ?? undefined, asistente: { maxDebit: libre } }, tx)
    return rama
  })
  return { rama, estado: await estadoSms(rama.id) }
}

/** Apaga el SMS: el número deja de tener perfil y la hoja del Asistente se revoca (con su hoja de datos). */
export const desactivarSms = async (branchId: string) => {
  const actual = await perfilDe(branchId)
  if (!actual) throw notFound('SMS de esta rama')
  await sql().query(`delete from profiles where channel = $1`, [actual.phone])
  await revoke(actual.mandateId)
  return actual
}
