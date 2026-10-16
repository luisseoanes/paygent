import { monthly, weekly, type Mandate } from '@openroute/shared'
import { emptyDb, replaceDb, db, type DB } from '../db.ts'
import { env } from '../env.ts'
import { setPin } from '../gateway/pin.ts'
import { delegate, putMandate, ROOT_ID } from '../gateway/mandates.ts'
import { pesos } from '../op/asset.ts'

// GW-01 / DEMO-01: estado inicial de la demo (el árbol de la sección 3.1 del documento del proyecto).
// Montos en pesos; pesos() los pasa a la moneda de la wallet de Juan.

/**
 * Súbela cada vez que cambie la semilla (topes, umbral de PIN, comercios, direcciones…). Al desplegar, una base
 * guardada con otra versión se vuelve a sembrar conservando el grant de Juan; si no, el volumen de Railway
 * conserva la semilla vieja para siempre (así se quedó el umbral de PIN en $2).
 */
export const SEED_VERSION = '2026-10-16.asistente-maria'

export const PHONE_MAMA = '+573001112233'
/** El chat de la PWA de María no tiene número: el Asistente la reconoce por este perfil. */
export const CHAT_MARIA = 'app:maria'
export const PIN_DEMO = '1234'

export const seed = ({ keepGrant = true } = {}) => {
  const previousGrant = keepGrant ? db.rootGrant : null
  const fresh: DB = { ...emptyDb(), rootGrant: previousGrant, seedVersion: SEED_VERSION }
  replaceDb(fresh)

  const now = new Date()
  const inOneYear = new Date(now.getTime() + 365 * 24 * 3600_000).toISOString()

  db.agents = {
    asistente: { id: 'asistente', name: 'Agente Asistente', role: 'assistant', apiKey: env.AGENT_KEY_ASSISTANT },
    guardian: { id: 'guardian', name: 'Agente Guardián', role: 'guardian', apiKey: env.AGENT_KEY_GUARDIAN },
    inventario: {
      id: 'inventario',
      name: 'Agente de Inventario',
      role: 'inventory',
      walletAddress: env.WALLET_INVENTARIO,
      apiKey: 'dev-inventory-key',
    },
  }

  db.merchants = {
    // Doña Rosa no tiene wallet de Open Payments: cobra por Puntored a su llave Bre-B (su celular).
    tienda: {
      id: 'tienda',
      name: 'Tienda Doña Rosa',
      wallet: 'puntored:tienda',
      category: 'mercado',
      payout: { via: 'puntored', llave: '3105550101' },
    },
    minimercado: { id: 'minimercado', name: 'Minimercado El Paisa', wallet: env.WALLET_TIENDA, category: 'mercado' },
    farmacia: { id: 'farmacia', name: 'Farmacia San José', wallet: env.WALLET_FARMACIA, category: 'farmacia' },
    puntored: { id: 'puntored', name: 'Puntored Efectivo', wallet: env.WALLET_PUNTORED, category: 'efectivo' },
    inventario: { id: 'inventario', name: 'Agente de Inventario', wallet: env.WALLET_INVENTARIO, category: 'datos', isAgent: true },
  }

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
  putMandate(root)

  delegate(ROOT_ID, {
    id: 'maria',
    holderType: 'person',
    holderId: 'maria',
    holderName: 'María',
    maxDebit: pesos(1_000_000),
    // 'datos' solo para que su Asistente pague las consultas al Inventario (categorías ⊆ padre).
    categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
  })
  delegate('maria', {
    id: 'maria-device',
    holderType: 'device',
    holderId: 'celular-maria',
    holderName: 'Celular de María',
    maxDebit: pesos(400_000),
    categories: ['mercado', 'farmacia'],
    offlineCap: pesos(80_000),
    offlineCapCeiling: pesos(200_000),
  })
  delegate('maria', {
    id: 'maria-sms',
    holderType: 'person',
    holderId: 'maria-sms',
    holderName: 'María (SMS)',
    maxDebit: pesos(200_000),
    pinThreshold: pesos(0), // siempre PIN
  })
  // El agente de María: habla con ella en el chat de su PWA. Es una hoja de SU rama, así que Juan lo ve y lo
  // puede revocar sin tocar a María. Decisión del equipo: $40 al mes, PIN si > $10.
  delegate('maria', {
    id: 'asistente-maria',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente de María',
    maxDebit: pesos(160_000),
    categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
    pinThreshold: pesos(40_000),
  })
  delegate('asistente-maria', {
    id: 'asistente-maria-datos',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente de María → Inventario',
    maxDebit: pesos(2000),
    categories: ['datos'],
  })
  delegate(ROOT_ID, {
    id: 'asistente',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente de la mamá',
    maxDebit: pesos(160_000),
    interval: weekly(now),
    categories: ['farmacia', 'mercado', 'datos'],
    // Decisión del equipo: PIN si > 40.000 COP (≈ $10). Compras menores las paga el agente sin preguntar.
    pinThreshold: pesos(40_000),
  })
  delegate('asistente', {
    id: 'asistente-datos',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente → Inventario',
    maxDebit: pesos(2000),
    categories: ['datos'],
  })
  delegate(ROOT_ID, {
    id: 'guardian',
    holderType: 'agent',
    holderId: 'guardian',
    holderName: 'Agente Guardián',
    maxDebit: pesos(0),
    canSpend: false, // solo puede RESTRINGIR
  })

  setPin('asistente', PIN_DEMO)
  setPin('maria-sms', PIN_DEMO)
  setPin('asistente-maria', PIN_DEMO)

  db.phones = {
    [PHONE_MAMA]: {
      phone: PHONE_MAMA,
      name: 'Doña Carmen',
      mandateId: 'asistente',
      dataMandateId: 'asistente-datos',
      location: { lat: 6.0, lng: -75.43 }, // municipio de Antioquia (sintético)
      rootId: ROOT_ID,
    },
    [CHAT_MARIA]: {
      phone: CHAT_MARIA,
      name: 'María',
      mandateId: 'asistente-maria',
      dataMandateId: 'asistente-maria-datos',
      location: { lat: 6.0, lng: -75.43 },
      rootId: ROOT_ID,
      chatFor: 'maria',
    },
  }

  // Juan la puede cambiar en /juan. Todo lo que pida el Asistente con envío llega a casa de María.
  db.addresses = {
    [ROOT_ID]: { recipientName: 'María', address: 'Vereda La Palma, casa 12, junto a la escuela' },
  }
}
