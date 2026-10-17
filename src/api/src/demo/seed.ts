import { monthly, weekly, type Mandate } from '@openroute/shared'
import { insertPayer, insertUser, payerOfRoot, type User } from '../store/accounts.ts'
import { upsertMerchant } from '../store/merchants.ts'
import { getMeta, setMeta } from '../store/meta.ts'
import { insertProfile, putAddress } from '../store/profiles.ts'
import { delegate, findMandate, linkHolderUser, putMandate } from '../gateway/mandates.ts'
import { hashSecret, setPin } from '../gateway/pin.ts'
import { conectarSms, UBICACION_POR_DEFECTO } from '../gateway/sms-canal.ts'
import { getRootAsset, pesos, resolveRootAsset } from './asset.ts'
import { DEMO_ROOT_ID as ROOT_ID } from './constants.ts'
import { importLegacyGrant } from '../store/legacy.ts'
import { sql, type Sql } from '../store/sql.ts'
import { DEMO_WALLETS } from './wallets.ts'

// GW-01 / DEMO-01: estado inicial de la demo (el árbol de la sección 3.1 del documento del proyecto).
// Montos en pesos; pesos() los pasa a la moneda de la wallet de Juan.

/**
 * Súbela cada vez que cambie la semilla (topes, umbral de PIN, comercios, direcciones…). Al desplegar, una base
 * guardada con otra versión se vuelve a sembrar conservando el grant de Juan (tabla root_grants, que la semilla
 * no toca) y la llave del gateway.
 */
export const SEED_VERSION = '2026-10-16.modos-de-consumo'

export const PHONE_MAMA = '+573001112233'
/** El celular de María: su modo SMS habla con el Asistente desde este número. */
export const PHONE_MARIA = '+573001110002'
/** El chat de la PWA de María no tiene número: el Asistente la reconoce por este perfil. */
export const CHAT_MARIA = 'app:maria'
export const PIN_DEMO = '1234'
/** Contraseña de las cuentas de demo (la misma que usa la web: src/web/src/config/demo-users.ts). */
export const DEMO_PASSWORD = 'paygent123'

/** Cuentas de la demo: quien delega (Juan) y quienes reciben la delegación o cobran. */
const DEMO_USERS: (User & { password?: boolean })[] = [
  { id: 'juan', name: 'Juan Pérez', documentType: 'CC', documentNumber: '1017000001', email: 'juan@paygent.dev', phone: '+13465550101', password: true },
  { id: 'maria', name: 'María Pérez', documentType: 'CC', documentNumber: '1017000002', email: 'maria@paygent.dev', phone: PHONE_MARIA, password: true },
  // Doña Carmen solo tiene un celular de teclas: sin correo ni contraseña, entra por SMS.
  { id: 'carmen', name: 'Carmen Pérez', documentType: 'CC', documentNumber: '32000003', phone: PHONE_MAMA },
  { id: 'rosa', name: 'Rosa Gómez', documentType: 'CC', documentNumber: '43000004', email: 'tendero@paygent.dev', phone: '+573105550101', password: true },
]

/**
 * Borra SOLO la demo: el árbol de Juan (con todo lo que cuelga de él), sus cuentas de demo y sus eventos. Los titulares,
 * beneficiarios, comercios y agentes dados de alta por la app no se tocan. Con keepGrant: false, también el grant de Juan.
 */
const wipe = async (tx: Sql, keepGrant: boolean) => {
  if (!keepGrant) await tx.query(`delete from root_grants where root_mandate_id = $1`, [ROOT_ID])
  const tree = `with recursive tree as (select id from mandates where id = $1
                  union all select m.id from mandates m join tree t on m.parent_id = t.id) select id from tree`
  await tx.query(`delete from feed_events where mandate_id in (${tree})`, [ROOT_ID])
  await tx.query(`delete from vouchers where mandate_id in (${tree})`, [ROOT_ID])
  await tx.query(`delete from device_certs where mandate_id in (${tree})`, [ROOT_ID])
  // Arrastra (on delete cascade) PIN, perfiles, dirección, dispositivos, pagos y compras pendientes del árbol.
  await tx.query(`delete from mandates where id = $1`, [ROOT_ID])
  await tx.query(`delete from users where id = any($1::text[])`, [DEMO_USERS.map((u) => u.id)])
}

export const seed = async ({ keepGrant = true } = {}) =>
  sql().tx(async (tx) => {
    await wipe(tx, keepGrant)
    const now = new Date()
    const inOneYear = new Date(now.getTime() + 365 * 24 * 3600_000).toISOString()

    const password = hashSecret(DEMO_PASSWORD)
    for (const { password: withPassword, ...u } of DEMO_USERS) await insertUser({ ...u, password: withPassword ? password : undefined }, tx)
    const asset = getRootAsset()
    await insertPayer({ userId: 'juan', walletAddress: DEMO_WALLETS.juan, assetCode: asset.assetCode, assetScale: asset.assetScale }, tx)
    // El grant de Juan sobrevive a la semilla: se vuelve a enlazar con su cuenta.
    await tx.query(`update root_grants set payer_id = 'juan' where root_mandate_id = $1 and payer_id is null`, [ROOT_ID])

    // Agentes y comercios de la demo: se crean si faltan; los que dio de alta la app se conservan.
    for (const a of [
      { id: 'asistente', name: 'Agente Asistente', role: 'assistant' as const },
      { id: 'guardian', name: 'Agente Guardián', role: 'guardian' as const },
      { id: 'inventario', name: 'Agente de Inventario', role: 'inventory' as const, walletAddress: DEMO_WALLETS.inventario },
    ])
      await tx.query(`insert into agents (id, name, role, wallet_address) values ($1, $2, $3, $4) on conflict (id) do nothing`, [
        a.id,
        a.name,
        a.role,
        a.walletAddress ?? null,
      ])

    // Doña Rosa no tiene wallet de Open Payments: cobra por Puntored a su llave Bre-B (su celular).
    await upsertMerchant(
      { id: 'tienda', name: 'Tienda Doña Rosa', wallet: 'puntored:tienda', category: 'mercado', payout: { via: 'puntored', llave: '3105550101' }, ownerUserId: 'rosa' },
      tx,
    )
    await upsertMerchant({ id: 'minimercado', name: 'Minimercado El Paisa', wallet: DEMO_WALLETS.minimercado, category: 'mercado' }, tx)
    await upsertMerchant({ id: 'farmacia', name: 'Farmacia San José', wallet: DEMO_WALLETS.farmacia, category: 'farmacia' }, tx)
    await upsertMerchant({ id: 'puntored', name: 'Puntored Efectivo', wallet: DEMO_WALLETS.puntored, category: 'efectivo' }, tx)
    await upsertMerchant(
      { id: 'inventario', name: 'Agente de Inventario', wallet: DEMO_WALLETS.inventario, category: 'datos', isAgent: true },
      tx,
    )

    // Raíz: lo que Juan aprueba en su billetera. Se actualiza en /callback con lo que de verdad aprobó.
    const root: Mandate = {
      id: ROOT_ID,
      parentId: null,
      holderType: 'person',
      holderId: 'juan',
      holderName: 'Juan',
      maxDebit: pesos(1_200_000),
      interval: monthly(now),
      spentInPeriod: pesos(0),
      periodStart: '',
      categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
      canSpend: true,
      expiresAt: inOneYear,
      revoked: false,
      frozen: false,
      signature: '',
    }
    await putMandate(root, tx)

    await delegate(
      ROOT_ID,
      {
        id: 'maria',
        holderType: 'person',
        holderId: 'maria',
        holderName: 'María',
        maxDebit: pesos(1_000_000),
        // 'datos' solo para que su Asistente pague las consultas al Inventario (categorías ⊆ padre).
        categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
      },
      tx,
    )
    await delegate(
      'maria',
      {
        id: 'maria-device',
        mode: 'celular',
        holderType: 'device',
        holderId: 'celular-maria',
        holderName: 'Celular de María',
        maxDebit: pesos(400_000),
        categories: ['mercado', 'farmacia'],
        offlineCap: pesos(80_000),
        offlineCapCeiling: pesos(200_000),
      },
      tx,
    )
    // Modo SMS de María: escribe al Asistente desde su número; es él quien paga, así que la rama es suya.
    await delegate(
      'maria',
      {
        id: 'maria-sms',
        mode: 'sms',
        holderType: 'agent',
        holderId: 'asistente',
        holderName: 'SMS de María',
        maxDebit: pesos(200_000),
        categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
        pinThreshold: pesos(0), // siempre PIN: el remitente de un SMS se puede suplantar
      },
      tx,
    )
    await delegate(
      'maria-sms',
      { id: 'maria-sms-datos', holderType: 'agent', holderId: 'asistente', holderName: 'SMS de María → Inventario', maxDebit: pesos(2000), categories: ['datos'] },
      tx,
    )
    // El agente de María: habla con ella en el chat de su PWA. Es una hoja de SU rama, así que Juan lo ve y lo
    // puede revocar sin tocar a María. Decisión del equipo: $40 al mes, PIN si > $10.
    await delegate(
      'maria',
      {
        id: 'asistente-maria',
        mode: 'asistente',
        holderType: 'agent',
        holderId: 'asistente',
        holderName: 'Asistente de María',
        maxDebit: pesos(160_000),
        categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
        pinThreshold: pesos(40_000),
      },
      tx,
    )
    await delegate(
      'asistente-maria',
      {
        id: 'asistente-maria-datos',
        holderType: 'agent',
        holderId: 'asistente',
        holderName: 'Asistente de María → Inventario',
        maxDebit: pesos(2000),
        categories: ['datos'],
      },
      tx,
    )
    await delegate(ROOT_ID, { id: 'guardian', holderType: 'agent', holderId: 'guardian', holderName: 'Agente Guardián', maxDebit: pesos(0), canSpend: false }, tx)

    // Quién es la persona detrás de cada rama (login y perfiles).
    await linkHolderUser(ROOT_ID, 'juan', tx)
    for (const id of ['maria', 'maria-device']) await linkHolderUser(id, 'maria', tx)

    // PIN de María: lo usan su Asistente y su SMS, que cuelgan de su rama (se busca subiendo por la cadena).
    await setPin('maria', PIN_DEMO, tx)
    await setPin('asistente-maria', PIN_DEMO, tx)

    // Doña Carmen: su número habla con el Asistente, que paga con su propia rama. El mismo camino que usa un titular
    // al activar el SMS de una rama (PUT /mandates/:id/sms).
    const location = UBICACION_POR_DEFECTO // municipio de Antioquia (sintético)
    await conectarSms(
      ROOT_ID,
      {
        phone: PHONE_MAMA,
        pin: PIN_DEMO,
        name: 'Doña Carmen',
        userId: 'carmen',
        location,
        asistente: {
          id: 'asistente',
          holderName: 'Asistente de la mamá',
          maxDebit: pesos(160_000),
          interval: weekly(now),
          categories: ['farmacia', 'mercado', 'datos'],
          // Decisión del equipo: PIN si > 40.000 COP (≈ $10). Compras menores las paga el agente sin preguntar.
          pinThreshold: pesos(40_000),
        },
        datos: { id: 'asistente-datos', holderName: 'Asistente → Inventario', maxDebit: pesos(2000) },
      },
      tx,
    )
    await insertProfile(
      {
        phone: CHAT_MARIA,
        userId: 'maria',
        name: 'María',
        mandateId: 'asistente-maria',
        dataMandateId: 'asistente-maria-datos',
        location,
        rootId: ROOT_ID,
        chatFor: 'maria',
      },
      tx,
    )

    await insertProfile(
      { phone: PHONE_MARIA, userId: 'maria', name: 'María', mandateId: 'maria-sms', dataMandateId: 'maria-sms-datos', location, rootId: ROOT_ID },
      tx,
    )

    // Juan la puede cambiar en /juan. Todo lo que pida el Asistente con envío llega a casa de María.
    await putAddress(ROOT_ID, { recipientName: 'María', address: 'Vereda La Palma, casa 12, junto a la escuela' }, tx)
    await setMeta('seed_version', SEED_VERSION, tx)
  })

/** Al arrancar: siembra la demo si falta, si Juan cambió de moneda o si la semilla cambió de versión. */
export const ensureDemoSeed = async () => {
  const asset = await resolveRootAsset((await payerOfRoot(ROOT_ID))?.walletAddress)
  const root = await findMandate(ROOT_ID)
  if (!root) {
    await importLegacyGrant(ROOT_ID)
    await seed()
  } else if (root.maxDebit.assetCode !== asset.assetCode || root.maxDebit.assetScale !== asset.assetScale) {
    // Si Juan cambió de moneda, el árbol y el grant guardados ya no sirven.
    await seed({ keepGrant: false })
  } else {
    const stored = await getMeta('seed_version')
    if (stored !== SEED_VERSION) {
      console.log(`[seed] semilla ${stored ?? 'sin versión'} → ${SEED_VERSION}: se vuelve a sembrar (el grant de Juan se conserva)`)
      await seed({ keepGrant: true })
    }
  }
}
