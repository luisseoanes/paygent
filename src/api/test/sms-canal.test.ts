import { describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { getProfile } from '../src/db.ts'
import { seed, PHONE_MAMA } from '../src/demo/seed.ts'
import { getMandate } from '../src/gateway/mandates.ts'
import { checkPin } from '../src/gateway/pin.ts'
import { normalizarCelular, pinSmsInvalido } from '../src/gateway/sms-canal.ts'

// El titular activa el SMS en una rama que delegó: número + PIN → perfil del Asistente para ese número.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })

const req = (method: 'GET' | 'PUT' | 'DELETE' | 'POST', url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({ method, url, payload, headers })

const titular = async (n: number) =>
  (
    await req('POST', '/auth/register/titular', {
      documento: `7100000${n}`,
      nombre: `Hijo${n}`,
      apellido: 'Prueba',
      email: `hijo${n}@correo.co`,
      telefono: `+5731100000${n}`,
      password: 'clave-segura',
      walletAddress: `$ilp.interledger-test.dev/hijo-${n}`,
    })
  ).json()

const ana = await titular(1)
const beto = await titular(2)
const comoAna = { 'x-user-id': ana.id }
const mama = (
  await req('POST', `/mandates/${ana.rootMandateId}/beneficiaries`, { alias: 'Mamá', maxDebit: A.cop(300_000), offlineCap: A.cop(50_000), pin: '4321' })
).json()
const persona = (
  await req('POST', `/mandates/${ana.rootMandateId}/delegate`, { holderType: 'person', holderId: 'tio', holderName: 'Tío', maxDebit: A.cop(100_000) })
).json()
const sms = (id: string, body: object, headers = comoAna) => req('PUT', `/mandates/${id}/sms`, body, headers)

describe('normalizarCelular', () => {
  it.each([
    ['3001112233', '+573001112233'],
    ['+57 300 111 2233', '+573001112233'],
    ['(300) 111-2233', '+573001112233'],
    ['57 300.111.2233', '+573001112233'],
    ['+1 346 555 0101', '+13465550101'],
  ])('%s → %s', (raw, e164) => expect(normalizarCelular(raw)).toBe(e164))

  it.each(['', '12345', '2001112233', 'abc3001112233', '+57'])('%s no es un celular', (raw) => expect(normalizarCelular(raw)).toBeNull())
})

describe('pinSmsInvalido', () => {
  it('acepta 4 números no triviales', () => expect(pinSmsInvalido('2580')).toBeNull())
  it.each(['123', '12345', 'abcd', '0000', '7777', '1234', '4321', '6789'])('rechaza %s', (pin) => expect(pinSmsInvalido(pin)).toBeTruthy())
})

describe('PUT /mandates/:id/sms', () => {
  it('activa el SMS desde el celular de la beneficiaria: conecta su modo SMS, PIN con hash y perfil', async () => {
    const res = await sms(mama.deviceMandateId, { phone: '300 555 1122', pin: '2580' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ active: true, phone: '+57 ••• ••• 1122' })

    const profile = await getProfile('+573005551122')
    expect(profile).toMatchObject({ name: 'Mamá', rootId: ana.rootMandateId, mandateId: body.mandateId, location: { lat: 6.0, lng: -75.43 } })
    // Es la hoja del modo SMS que se creó al darla de alta (20 % de su tope), y paga siempre con PIN.
    const asistente = await getMandate(body.mandateId)
    expect(asistente).toMatchObject({ parentId: mama.mandateId, mode: 'sms', holderType: 'agent', holderId: 'asistente', maxDebit: A.cop(60_000) })
    expect(A.isZero(asistente.pinThreshold!)).toBe(true)
    expect((await getMandate(profile!.dataMandateId)).parentId).toBe(body.mandateId)
    expect(await checkPin(body.mandateId, '2580')).toBe(true)
    expect(await checkPin(body.mandateId, '4321')).toBe(false)

    expect((await req('GET', `/mandates/${mama.deviceMandateId}/sms`, undefined, comoAna)).json()).toMatchObject({ active: true, phone: '+57 ••• ••• 1122' })
  })

  it('otra vez en la misma rama cambia número y PIN sin crear otra rama', async () => {
    const antes = (await req('GET', `/mandates/${mama.deviceMandateId}/sms`, undefined, comoAna)).json()
    const res = await sms(mama.deviceMandateId, { phone: '+57 300 555 3344', pin: '9182' })
    expect(res.json()).toMatchObject({ active: true, phone: '+57 ••• ••• 3344', mandateId: antes.mandateId })
    expect(await getProfile('+573005551122')).toBeUndefined()
    expect((await getProfile('+573005553344'))?.mandateId).toBe(antes.mandateId)
    expect(await checkPin(antes.mandateId, '9182')).toBe(true)
  })

  it('un número que ya usa otra rama → 409', async () => {
    expect((await sms(persona.id, { phone: '3005553344', pin: '2580' })).statusCode).toBe(409)
    expect((await sms(persona.id, { phone: PHONE_MAMA, pin: '2580' })).statusCode).toBe(409)
  })

  it('número o PIN inválidos → 400', async () => {
    expect((await sms(persona.id, { phone: '12345', pin: '2580' })).statusCode).toBe(400)
    expect((await sms(persona.id, { phone: '3005550000', pin: '0000' })).statusCode).toBe(400)
    expect((await sms(persona.id, { phone: '3005550000' })).statusCode).toBe(400)
  })

  it('ni la raíz, ni un agente, ni una rama sin cupo libre', async () => {
    expect((await sms(ana.rootMandateId, { phone: '3005550000', pin: '2580' })).statusCode).toBe(400)
    const agente = (await getProfile('+573005553344'))!.mandateId
    expect((await sms(agente, { phone: '3005550000', pin: '2580' })).statusCode).toBe(400)
    // Una persona que ya repartió todo su tope (como un alta de antes de los modos).
    const tio2 = (
      await req('POST', `/mandates/${ana.rootMandateId}/delegate`, { holderType: 'person', holderId: 'tio2', holderName: 'Tío 2', maxDebit: A.cop(10_000) })
    ).json()
    await req('POST', `/mandates/${tio2.id}/delegate`, { holderType: 'device', holderId: 'cel-tio2', maxDebit: A.cop(10_000), offlineCap: A.cop(1_000) })
    const lleno = await sms(tio2.id, { phone: '3005550000', pin: '2580' })
    expect(lleno.statusCode).toBe(409)
    expect(lleno.json().error).toMatch(/cupo/)
  })

  it('solo el titular dueño de la raíz; nunca un agente', async () => {
    expect((await sms(persona.id, { phone: '3005550000', pin: '2580' }, {} as typeof comoAna)).statusCode).toBe(401)
    expect((await sms(persona.id, { phone: '3005550000', pin: '2580' }, { 'x-user-id': beto.id })).statusCode).toBe(403)
    const agente = { 'x-user-id': ana.id, 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }
    expect((await req('PUT', `/mandates/${persona.id}/sms`, { phone: '3005550000', pin: '2580' }, agente)).statusCode).toBe(403)
    expect((await req('GET', `/mandates/${persona.id}/sms`, undefined, { 'x-user-id': beto.id })).statusCode).toBe(403)
  })

  it('una persona con cupo libre también lo puede activar', async () => {
    const res = await sms(persona.id, { phone: '3005550000', pin: '2580' })
    expect(res.statusCode).toBe(200)
    expect((await getProfile('+573005550000'))?.name).toBe('Tío')
  })
})

describe('DELETE /mandates/:id/sms', () => {
  it('apaga el SMS: el número deja de tener perfil y la rama del Asistente queda revocada', async () => {
    const { mandateId } = (await req('GET', `/mandates/${persona.id}/sms`, undefined, comoAna)).json()
    const res = await req('DELETE', `/mandates/${persona.id}/sms`, undefined, comoAna)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ active: false })
    expect(await getProfile('+573005550000')).toBeUndefined()
    expect((await getMandate(mandateId)).revoked).toBe(true)
    expect((await getMandate(persona.id)).revoked).toBe(false)
    expect((await req('GET', `/mandates/${persona.id}/sms`, undefined, comoAna)).json()).toEqual({ active: false })
    // Se puede volver a activar: la rama revocada ya no cuenta para el cupo.
    expect((await sms(persona.id, { phone: '3005550000', pin: '2580' })).statusCode).toBe(200)
  })

  it('sin SMS activo → 404', async () => {
    const otra = (
      await req('POST', `/mandates/${ana.rootMandateId}/delegate`, { holderType: 'person', holderId: 'prima', holderName: 'Prima', maxDebit: A.cop(10_000) })
    ).json()
    expect((await req('DELETE', `/mandates/${otra.id}/sms`, undefined, comoAna)).statusCode).toBe(404)
  })
})

describe('La semilla usa el mismo camino', () => {
  it('Doña Carmen: su número apunta a la rama del Asistente con su PIN', async () => {
    expect(await getProfile(PHONE_MAMA)).toMatchObject({ name: 'Doña Carmen', mandateId: 'asistente', dataMandateId: 'asistente-datos', userId: 'carmen', rootId: 'root' })
    expect(await checkPin('asistente', '1234')).toBe(true)
    expect((await getMandate('asistente')).pinThreshold).toEqual(A.cop(40_000))
  })
})
