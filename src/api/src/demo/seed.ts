import { amount as A, monthly, weekly, type Mandate } from '@openroute/shared'
import { emptyDb, replaceDb, db, type DB } from '../db.ts'
import { env } from '../env.ts'
import { setPin } from '../gateway/pin.ts'
import { delegate, putMandate, ROOT_ID } from '../gateway/mandates.ts'

// GW-01 / DEMO-01: estado inicial de la demo (el árbol de la sección 3.1 del documento del proyecto).

export const PHONE_MAMA = '+573001112233'
export const PIN_DEMO = '1234'

export const seed = ({ keepGrant = true } = {}) => {
  const previousGrant = keepGrant ? db.rootGrant : null
  const fresh: DB = { ...emptyDb(), rootGrant: previousGrant }
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
    maxDebit: A.usd(300),
    interval: monthly(now),
    spentInPeriod: A.usd(0),
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
    maxDebit: A.usd(250),
    categories: ['mercado', 'farmacia', 'efectivo'],
  })
  delegate('maria', {
    id: 'maria-device',
    holderType: 'device',
    holderId: 'celular-maria',
    holderName: 'Celular de María',
    maxDebit: A.usd(100),
    categories: ['mercado', 'farmacia'],
    offlineCap: A.usd(20),
    offlineCapCeiling: A.usd(50),
  })
  delegate('maria', {
    id: 'maria-sms',
    holderType: 'person',
    holderId: 'maria-sms',
    holderName: 'María (SMS)',
    maxDebit: A.usd(50),
    pinThreshold: A.usd(0), // siempre PIN
  })
  delegate(ROOT_ID, {
    id: 'asistente',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente de la mamá',
    maxDebit: A.usd(40),
    interval: weekly(now),
    categories: ['farmacia', 'mercado', 'datos'],
    // Decisión del equipo: PIN si > $10 (≈ 40.000 COP). Compras menores las paga el agente sin preguntar.
    pinThreshold: A.usd(10),
  })
  delegate('asistente', {
    id: 'asistente-datos',
    holderType: 'agent',
    holderId: 'asistente',
    holderName: 'Asistente → Inventario',
    maxDebit: A.usd(0.5),
    categories: ['datos'],
  })
  delegate(ROOT_ID, {
    id: 'guardian',
    holderType: 'agent',
    holderId: 'guardian',
    holderName: 'Agente Guardián',
    maxDebit: A.usd(0),
    canSpend: false, // solo puede RESTRINGIR
  })

  setPin('asistente', PIN_DEMO)
  setPin('maria-sms', PIN_DEMO)

  db.phones = {
    [PHONE_MAMA]: {
      phone: PHONE_MAMA,
      name: 'Doña Carmen',
      mandateId: 'asistente',
      dataMandateId: 'asistente-datos',
      location: { lat: 6.0, lng: -75.43 }, // municipio de Antioquia (sintético)
      rootId: ROOT_ID,
    },
  }

  // Juan la puede cambiar en /juan. Todo lo que pida el Asistente con envío llega a casa de María.
  db.addresses = {
    [ROOT_ID]: { recipientName: 'María', address: 'Vereda La Palma, casa 12, junto a la escuela' },
  }
}
