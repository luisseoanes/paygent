import { describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { getActiveGrant } from '../src/store/grants.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { getMandate } from '../src/gateway/mandates.ts'
import { asUser } from './helpers.ts'

// Cuantos titulares se quiera, cada uno con su raíz, su grant, su feed y sus beneficiarios.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })
const service = { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }

const post = (url: string, payload: object, headers = {}) => app.inject({ method: 'POST', url, payload, headers })
const titular = (n: number) =>
  post('/auth/register/titular', {
    documento: `9000000${n}`,
    nombre: `Titular${n}`,
    apellido: 'Prueba',
    email: `titular${n}@correo.co`,
    telefono: `+5730000000${n}`,
    password: 'clave-segura',
    walletAddress: `$ilp.interledger-test.dev/titular-${n}`,
  })

const ana = (await titular(1)).json()
const beto = (await titular(2)).json()

describe('Alta de titulares', () => {
  it('cada titular tiene su cuenta, su wallet y SU mandato raíz', async () => {
    expect(ana).toMatchObject({ role: 'titular', name: 'Titular1', walletAddress: 'https://ilp.interledger-test.dev/titular-1' })
    expect(ana.rootMandateId).not.toBe(beto.rootMandateId)
    expect(ana.rootMandateId).not.toBe('root')
    const root = await getMandate(ana.rootMandateId)
    expect(root).toMatchObject({ parentId: null, holderType: 'person', holderName: 'Titular1' })
    expect((await post('/auth/login', { email: 'TITULAR1@correo.co', password: 'clave-segura' })).json().rootMandateId).toBe(ana.rootMandateId)
  })

  it('correo, documento, celular o wallet repetidos → 409', async () => {
    expect((await titular(1)).statusCode).toBe(409)
    const otraWallet = await post('/auth/register/titular', {
      documento: '1', nombre: 'X', apellido: 'Y', email: 'x@correo.co', telefono: '+571', password: 'clave-segura',
      walletAddress: 'https://ilp.interledger-test.dev/titular-1',
    })
    expect(otraWallet.statusCode).toBe(409)
  })
})

describe('Beneficiarios de cada titular', () => {
  it('se enlazan con el código de la rama que les dio su titular', async () => {
    const rama = (
      await post(`/mandates/${ana.rootMandateId}/delegate`, { holderType: 'person', holderId: 'hija-ana', holderName: 'Hija de Ana', maxDebit: A.cop(100_000) }, asUser(ana.id))
    ).json()
    const res = await post('/auth/register/beneficiario', {
      documento: '80000001', nombre: 'Hija de Ana', email: 'hija@correo.co', telefono: '+573110000001', password: 'clave-segura', mandateId: rama.id,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ role: 'beneficiario', mandateId: rama.id, rootMandateId: null })

    const otraVez = await post('/auth/register/beneficiario', {
      documento: '80000002', nombre: 'Otra', email: 'otra@correo.co', telefono: '+573110000002', password: 'clave-segura', mandateId: rama.id,
    })
    expect(otraVez.statusCode).toBe(409)
    const sinRama = await post('/auth/register/beneficiario', {
      documento: '80000003', nombre: 'Otra', email: 'otra3@correo.co', telefono: '+573110000003', password: 'clave-segura', mandateId: 'no-existe',
    })
    expect(sinRama.statusCode).toBe(400)
  })
})

describe('Grant, pagos y feed por titular', () => {
  it('cada titular firma su propio grant; el de los demás no cambia', async () => {
    const { redirectUrl } = (await post('/mandates/root', { rootMandateId: ana.rootMandateId }, asUser(ana.id))).json()
    expect(redirectUrl).toContain(`/callback/${ana.rootMandateId}`)
    const back = await app.inject({ method: 'GET', url: new URL(redirectUrl).pathname + new URL(redirectUrl).search })
    expect(back.headers.location).toMatch(/ok=1/)

    expect(await getActiveGrant(ana.rootMandateId)).not.toBeNull()
    expect(await getActiveGrant(beto.rootMandateId)).toBeNull()
    expect((await app.inject({ method: 'GET', url: `/demo/status?root=${ana.rootMandateId}` })).json().rootGrant).toBe(true)
    expect((await app.inject({ method: 'GET', url: `/demo/status?root=${beto.rootMandateId}` })).json().rootGrant).toBe(false)
  })

  it('un pago en el árbol de Ana solo gasta del tope de Ana, y solo Ana lo ve en su feed', async () => {
    const agente = (
      await post(`/mandates/${ana.rootMandateId}/delegate`, {
        holderType: 'agent', holderId: 'asistente', holderName: 'Asistente de Ana', maxDebit: A.cop(50_000), categories: ['farmacia'],
      }, asUser(ana.id))
    ).json()
    const pay = await post(
      '/pay',
      { mandateId: agente.id, merchantWallet: DEMO_WALLETS.farmacia, amount: A.cop(12_000), category: 'farmacia', reason: 'losartán para Ana' },
      service,
    )
    expect(pay.json().result).toBe('allow')
    expect((await getMandate(ana.rootMandateId)).spentInPeriod).toEqual(A.cop(12_000))
    expect((await getMandate(beto.rootMandateId)).spentInPeriod).toEqual(A.cop(0))
    expect((await getMandate('root')).spentInPeriod).toEqual(A.cop(0))

    const feedAna = (await app.inject({ method: 'GET', url: `/feed?root=${ana.rootMandateId}`, headers: asUser(ana.id) })).json()
    const feedBeto = (await app.inject({ method: 'GET', url: `/feed?root=${beto.rootMandateId}`, headers: asUser(beto.id) })).json()
    expect(feedAna.some((e: { reason?: string }) => e.reason === 'losartán para Ana')).toBe(true)
    expect(feedBeto).toHaveLength(0)
  })

  it('resetear la demo no borra a los titulares registrados ni su grant', async () => {
    await post('/demo/reset', { full: true }, asUser('juan'))
    expect((await post('/auth/login', { email: 'titular1@correo.co', password: 'clave-segura' })).statusCode).toBe(200)
    expect(await getActiveGrant(ana.rootMandateId)).not.toBeNull()
    expect((await getMandate(ana.rootMandateId)).spentInPeriod).toEqual(A.cop(12_000))
  })
})

describe('El titular registra un beneficiario: alias, tope, PIN y tope sin señal', () => {
  it('sale de su raíz, crea la persona (PIN siempre) y su celular, y entrega el código para enlazar', async () => {
    const res = await post(`/mandates/${beto.rootMandateId}/beneficiaries`, {
      alias: 'Mamá de Beto', maxDebit: A.cop(200_000), offlineCap: A.cop(50_000), pin: '4321',
    }, asUser(beto.id))
    expect(res.statusCode).toBe(201)
    const { code, mandateId } = res.json()
    const persona = await getMandate(mandateId)
    expect(persona).toMatchObject({ parentId: beto.rootMandateId, holderType: 'person', holderName: 'Mamá de Beto', pinThreshold: A.cop(0) })
    // Lo que puso el titular es el techo; el celular arranca con el 40 % y el Guardián lo sube con buen uso
    expect(await getMandate(code)).toMatchObject({
      parentId: mandateId,
      holderType: 'device',
      offlineCap: A.cop(20_000),
      offlineCapCeiling: A.cop(50_000),
    })

    const enlace = await post('/auth/register/beneficiario', {
      documento: '70000001', nombre: 'Rosa Beto', email: 'mama.beto@correo.co', telefono: '+573120000001', password: 'clave-segura', mandateId: code,
    })
    // Primero la rama del celular: con ella /billetera enlaza el teléfono.
    expect(enlace.json()).toMatchObject({ role: 'beneficiario', mandateId: code, mandateIds: [code, mandateId] })
  })

  it('PIN, tope y tope sin señal son obligatorios; el tope sin señal no puede superar el del periodo', async () => {
    const base = { alias: 'X', maxDebit: A.cop(10_000), offlineCap: A.cop(5_000), pin: '1234' }
    const url = `/mandates/${beto.rootMandateId}/beneficiaries`
    const post = (u: string, body: object) => app.inject({ method: 'POST', url: u, payload: body, headers: asUser(beto.id) })
    expect((await post(url, { ...base, pin: '12' })).statusCode).toBe(400)
    expect((await post(url, { ...base, pin: undefined })).statusCode).toBe(400)
    expect((await post(url, { ...base, offlineCap: undefined })).statusCode).toBe(400)
    expect((await post(url, { ...base, maxDebit: undefined })).statusCode).toBe(400)
    const pasado = await post(url, { ...base, offlineCap: A.cop(20_000) })
    expect(pasado.statusCode).toBe(400)
    expect(pasado.json().error).toMatch(/sin señal/)
  })

  it('no se puede colgar de una rama que no sea la raíz', async () => {
    const res = await post(`/mandates/maria/beneficiaries`, { alias: 'X', maxDebit: A.cop(1), offlineCap: A.cop(1), pin: '1234' }, asUser('juan'))
    expect(res.statusCode).toBe(400)
  })
})
