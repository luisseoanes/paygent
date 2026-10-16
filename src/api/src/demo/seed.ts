import { monthly, weekly, type Mandate } from '@openroute/shared'
import { insertAgent, insertPayer, insertProfile, insertUser, putAddress, setMeta, upsertMerchant, type User } from '../db.ts'
import { delegate, linkHolderUser, putMandate, ROOT_ID } from '../gateway/mandates.ts'
import { hashSecret, setPin } from '../gateway/pin.ts'
import { getRootAsset, pesos } from '../op/asset.ts'
import { sql, type Sql } from '../store/sql.ts'
import { DEMO_WALLETS } from './wallets.ts'

// GW-01 / DEMO-01: estado inicial de la demo (el árbol de la sección 3.1 del documento del proyecto).
// Montos en pesos; pesos() los pasa a la moneda de la wallet de Juan.

/**
 * Súbela cada vez que cambie la semilla (topes, umbral de PIN, comercios, direcciones…). Al desplegar, una base
 * guardada con otra versión se vuelve a sembrar conservando el grant de Juan (tabla root_grants, que la semilla
 * no toca) y la llave del gateway.
 */
export const SEED_VERSION = '2026-10-16.postgres-cuentas'

export const PHONE_MAMA = '+573001112233'
/** El chat de la PWA de María no tiene número: el Asistente la reconoce por este perfil. */
export const CHAT_MARIA = 'app:maria'
export const PIN_DEMO = '1234'
/** Contraseña de las cuentas de demo (la misma que usa la web: src/web/src/config/demo-users.ts). */
export const DEMO_PASSWORD = 'paygent123'

/** Cuentas de la demo: quien delega (Juan) y quienes reciben la delegación o cobran. */
const DEMO_USERS: (User & { password?: boolean })[] = [
  { id: 'juan', name: 'Juan Pérez', documentType: 'CC', documentNumber: '1017000001', email: 'juan@paygent.dev', phone: '+13465550101', password: true },
  { id: 'maria', name: 'María Pérez', documentType: 'CC', documentNumber: '1017000002', email: 'maria@paygent.dev', phone: '+573001110002', password: true },
  // Doña Carmen solo tiene un celular de teclas: sin correo ni contraseña, entra por SMS.
  { id: 'carmen', name: 'Carmen Pérez', documentType: 'CC', documentNumber: '32000003', phone: PHONE_MAMA },
  { id: 'rosa', name: 'Rosa Gómez', documentType: 'CC', documentNumber: '43000004', email: 'tendero@paygent.dev', phone: '+573105550101', password: true },
]

/** Borra todo lo de la demo salvo el grant de Juan (y, con keepGrant: false, también el grant). */
const wipe = async (tx: Sql, keepGrant: boolean) => {
  if (!keepGrant) await tx.query(`delete from root_grants`)
  // mandates arrastra (on delete cascade) PIN, perfiles, dirección, dispositivos, pagos y compras pendientes.
  for (const table of ['feed_events', 'vouchers', 'device_certs', 'mandates', 'merchants', 'agents', 'payers', 'users'])
    await tx.query(`delete from ${table}`)
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

    for (const a of [
      { id: 'asistente', name: 'Agente Asistente', role: 'assistant' as const },
      { id: 'guardian', name: 'Agente Guardián', role: 'guardian' as const },
      { id: 'inventario', name: 'Agente de Inventario', role: 'inventory' as const, walletAddress: DEMO_WALLETS.inventario },
    ])
      await insertAgent(a, tx)

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
    await delegate(
      'maria',
      {
        id: 'maria-sms',
        holderType: 'person',
        holderId: 'maria-sms',
        holderName: 'María (SMS)',
        maxDebit: pesos(200_000),
        pinThreshold: pesos(0), // siempre PIN
      },
      tx,
    )
    // El agente de María: habla con ella en el chat de su PWA. Es una hoja de SU rama, así que Juan lo ve y lo
    // puede revocar sin tocar a María. Decisión del equipo: $40 al mes, PIN si > $10.
    await delegate(
      'maria',
      {
        id: 'asistente-maria',
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
    await delegate(
      ROOT_ID,
      {
        id: 'asistente',
        holderType: 'agent',
        holderId: 'asistente',
        holderName: 'Asistente de la mamá',
        maxDebit: pesos(160_000),
        interval: weekly(now),
        categories: ['farmacia', 'mercado', 'datos'],
        // Decisión del equipo: PIN si > 40.000 COP (≈ $10). Compras menores las paga el agente sin preguntar.
        pinThreshold: pesos(40_000),
      },
      tx,
    )
    await delegate(
      'asistente',
      {
        id: 'asistente-datos',
        holderType: 'agent',
        holderId: 'asistente',
        holderName: 'Asistente → Inventario',
        maxDebit: pesos(2000),
        categories: ['datos'],
      },
      tx,
    )
    await delegate(ROOT_ID, { id: 'guardian', holderType: 'agent', holderId: 'guardian', holderName: 'Agente Guardián', maxDebit: pesos(0), canSpend: false }, tx)

    // Quién es la persona detrás de cada rama (login y perfiles).
    await linkHolderUser(ROOT_ID, 'juan', tx)
    for (const id of ['maria', 'maria-device', 'maria-sms']) await linkHolderUser(id, 'maria', tx)

    await setPin('asistente', PIN_DEMO, tx)
    await setPin('maria-sms', PIN_DEMO, tx)
    await setPin('asistente-maria', PIN_DEMO, tx)

    const location = { lat: 6.0, lng: -75.43 } // municipio de Antioquia (sintético)
    await insertProfile(
      { phone: PHONE_MAMA, userId: 'carmen', name: 'Doña Carmen', mandateId: 'asistente', dataMandateId: 'asistente-datos', location, rootId: ROOT_ID },
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

    // Juan la puede cambiar en /juan. Todo lo que pida el Asistente con envío llega a casa de María.
    await putAddress(ROOT_ID, { recipientName: 'María', address: 'Vereda La Palma, casa 12, junto a la escuela' }, tx)
    await setMeta('seed_version', SEED_VERSION, tx)
  })
