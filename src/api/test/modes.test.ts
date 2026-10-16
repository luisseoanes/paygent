import { describe, expect, it } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { delegate, getMandate } from '../src/gateway/mandates.ts'

// Modos de consumo: al registrar un beneficiario quedan habilitados celular (vale QR, con o sin señal), Asistente
// (chat de la app) y SMS; el titular los quita, los vuelve a habilitar y les cambia el tope.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })
const service = { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }
// Lo que solo decide el titular: la web manda su cuenta en x-user-id.
const comoTitular = () => ({ 'x-user-id': titular.id })

const post = (url: string, payload: object, headers = {}) => app.inject({ method: 'POST', url, payload, headers })
const patch = (url: string, payload: object, headers: Record<string, string> = comoTitular()) => app.inject({ method: 'PATCH', url, payload, headers })
const get = (url: string) => app.inject({ method: 'GET', url })

const titular = (
  await post('/auth/register/titular', {
    documento: '91000001', nombre: 'Pedro', apellido: 'Gómez', email: 'pedro@correo.co', telefono: '+573009990001',
    password: 'clave-segura', walletAddress: '$ilp.interledger-test.dev/pedro-gomez',
  })
).json()
// La raíz tiene 1.200.000: cada alta usa 100.000 para que quepan todas.
const alta = (alias: string, offlineCap = 10_000) =>
  post(`/mandates/${titular.rootMandateId}/beneficiaries`, { alias, maxDebit: A.cop(100_000), offlineCap: A.cop(offlineCap), pin: '246810' })
type Modo = { mode: string; mandateId: string; maxDebit: Amount; phone?: string }
const modosDe = async (id: string): Promise<Modo[]> => (await get(`/mandates/${id}/modes`)).json().modes

describe('Alta de beneficiario con todos los modos', () => {
  it('reparte su tope: celular 40 %, Asistente 20 %, SMS 20 % y 20 % libre', async () => {
    const res = await alta('Mamá')
    expect(res.statusCode).toBe(201)
    const { code, mandateId, modes } = res.json()
    expect(modes.map((m: Modo) => [m.mode, m.maxDebit.value])).toEqual([
      ['celular', A.cop(40_000).value],
      ['asistente', A.cop(20_000).value],
      ['sms', A.cop(20_000).value],
    ])
    expect(code).toBe(modes[0].mandateId)
    // Lo que pone el titular es el techo sin señal; el celular arranca con el 40 % (lo mueve el Guardián).
    expect(await getMandate(code)).toMatchObject({ holderType: 'device', mode: 'celular', offlineCap: A.cop(4_000), offlineCapCeiling: A.cop(10_000) })
    // Los dos del Asistente son ramas del agente (si no, /pay no lo deja pagar); el SMS pide PIN siempre.
    const [, chat, sms] = modes as Modo[]
    // Umbral del equipo (40.000) recortado al tope del modo: nunca un umbral por encima de lo que puede gastar.
    expect(await getMandate(chat.mandateId)).toMatchObject({ holderType: 'agent', holderId: 'asistente', pinThreshold: A.cop(20_000) })
    expect(await getMandate(sms.mandateId)).toMatchObject({ holderType: 'agent', holderId: 'asistente', pinThreshold: A.cop(0) })
    expect(await getMandate(`${chat.mandateId}-datos`)).toMatchObject({ categories: ['datos'], maxDebit: A.cop(2000) })
    expect((await getMandate(mandateId)).parentId).toBe(titular.rootMandateId)
  })

  it('un techo sin señal mayor que el 40 % se respeta: el celular toma lo necesario', async () => {
    const { modes } = (await alta('Tía', 60_000)).json()
    expect(modes[0]).toMatchObject({ mode: 'celular', maxDebit: A.cop(60_000), offlineCap: A.cop(24_000) })
    expect(modes.map((m: Modo) => m.mode)).toEqual(['celular', 'asistente', 'sms'])
  })

  it('el chat de la app ya habla con su Asistente; el SMS se activa al enlazar la cuenta con su celular', async () => {
    const { code, mandateId } = (await alta('Abuela')).json()
    const chat = await post('/asistente/chat', { mensajes: [{ rol: 'usuario', texto: 'hola' }], contexto: { mandato: code } })
    expect(chat.json().error ?? '').not.toMatch(/Vincula/)
    expect((await modosDe(mandateId)).find((m) => m.mode === 'sms')?.phone).toBeUndefined()

    await post('/auth/register/beneficiario', {
      documento: '71000001', nombre: 'Abuela', email: 'abuela@correo.co', telefono: '+573129990001', password: 'clave-segura', mandateId: code,
    })
    const sms = (await modosDe(mandateId)).find((m) => m.mode === 'sms')!
    expect(sms.phone).toBe('+573129990001')
    const perfil = (await get('/sms/profile?phone=%2B573129990001')).json()
    expect(perfil).toMatchObject({ mandateId: sms.mandateId, dataMandateId: `${sms.mandateId}-datos`, asset: { assetCode: 'COP' } })
  })

  it('el Asistente paga con el modo SMS, y siempre con PIN', async () => {
    const { mandateId } = (await alta('Prima')).json()
    const sms = (await modosDe(mandateId)).find((m) => m.mode === 'sms')!
    const pay = await post(
      '/pay',
      { mandateId: sms.mandateId, merchantWallet: DEMO_WALLETS.farmacia, amount: A.cop(1_000), category: 'farmacia', reason: 'prueba' },
      service,
    )
    expect(pay.json().result).toBe('needs_pin')
  })
})

describe('El titular administra los modos', () => {
  it('sube un modo con lo que queda libre, pero no más allá del tope de la persona', async () => {
    const { mandateId } = (await alta('Hermana')).json()
    const chat = (await modosDe(mandateId)).find((m) => m.mode === 'asistente')!
    const ok = await patch(`/mandates/${chat.mandateId}/limits`, { maxDebit: A.cop(40_000) })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().maxDebit).toEqual(A.cop(40_000))
    const pasado = await patch(`/mandates/${chat.mandateId}/limits`, { maxDebit: A.cop(40_001) })
    expect(pasado.statusCode).toBe(403)
  })

  it('el titular mueve el techo sin señal; bajar el celular por debajo de él también lo baja', async () => {
    const { code } = (await alta('Sobrina', 35_000)).json()
    const res = await patch(`/mandates/${code}/limits`, { maxDebit: A.cop(30_000) })
    expect(res.json()).toMatchObject({ maxDebit: A.cop(30_000), offlineCap: A.cop(14_000), offlineCapCeiling: A.cop(30_000) })
    expect((await patch(`/mandates/${code}/limits`, { offlineCap: A.cop(40_000) })).statusCode).toBe(400)
    // Un techo por debajo del tope vigente arrastra el vigente; por encima, lo deja donde lo puso el Guardián.
    expect((await patch(`/mandates/${code}/limits`, { offlineCap: A.cop(10_000) })).json()).toMatchObject({
      offlineCap: A.cop(10_000), offlineCapCeiling: A.cop(10_000),
    })
    expect((await patch(`/mandates/${code}/limits`, { offlineCap: A.cop(20_000) })).json()).toMatchObject({
      offlineCap: A.cop(10_000), offlineCapCeiling: A.cop(20_000),
    })
  })

  it('solo su titular cambia topes (nunca un agente), y la raíz no se toca desde aquí', async () => {
    const { code } = (await alta('Vecina')).json()
    expect((await patch(`/mandates/${code}/limits`, { maxDebit: A.cop(1) }, service)).statusCode).toBe(403)
    expect((await patch(`/mandates/${code}/limits`, { maxDebit: A.cop(1) }, {})).statusCode).toBe(401)
    expect((await patch(`/mandates/${code}/limits`, { maxDebit: A.cop(1) }, { 'x-user-id': 'juan' })).statusCode).toBe(403)
    expect((await patch(`/mandates/${titular.rootMandateId}/limits`, { maxDebit: A.cop(1) })).statusCode).toBe(400)
    expect((await patch(`/mandates/${code}/limits`, { maxDebit: A.usd(1) })).statusCode).toBe(400)
  })

  it('quitar un modo es revocarlo; habilitar de nuevo crea otra rama con su parte', async () => {
    const { mandateId } = (await alta('Cuñada')).json()
    const sms = (await modosDe(mandateId)).find((m) => m.mode === 'sms')!
    await post(`/mandates/${sms.mandateId}/revoke`, {})
    expect((await modosDe(mandateId)).map((m) => m.mode)).toEqual(['celular', 'asistente'])

    const res = await post(`/mandates/${mandateId}/modes`, {}, comoTitular())
    expect(res.json().created).toEqual(['sms'])
    const nuevo = (await modosDe(mandateId)).find((m) => m.mode === 'sms')!
    expect(nuevo.mandateId).not.toBe(sms.mandateId)
    expect((await post(`/mandates/${mandateId}/modes`, {}, comoTitular())).json().created).toEqual([])
  })
})

describe('El SMS que activa el titular (PUT /mandates/:id/sms)', () => {
  it('conecta la hoja del modo SMS en vez de crear otra, con el número y el PIN que da el titular', async () => {
    const { mandateId, code } = (await alta('Madrina')).json()
    const sms = (await modosDe(mandateId)).find((m) => m.mode === 'sms')!
    const put = (id: string) =>
      app.inject({ method: 'PUT', url: `/mandates/${id}/sms`, payload: { phone: '3129990077', pin: '2580' }, headers: comoTitular() })
    // Desde la rama del celular también: el SMS es de la persona.
    expect((await put(code)).json()).toMatchObject({ active: true, mandateId: sms.mandateId })
    expect((await get('/sms/profile?phone=%2B573129990077')).json().mandateId).toBe(sms.mandateId)
    const hojas = (await app.inject({ method: 'GET', url: `/mandates/${mandateId}/tree` })).json().children
    expect(hojas.filter((h: { holderType: string; revoked: boolean }) => h.holderType === 'agent' && !h.revoked)).toHaveLength(2)
  })
})

describe('Beneficiarios dados de alta antes de los modos', () => {
  it('habilitar los modos baja el celular a su parte y crea el Asistente y el SMS', async () => {
    // Como lo dejaba el alta anterior: persona + celular sin `mode` con todo el tope.
    const persona = await delegate(titular.rootMandateId, {
      id: 'b_legacy', holderType: 'person', holderId: 'b_legacy', holderName: 'Legado', maxDebit: A.cop(100_000), pinThreshold: A.cop(0),
    })
    await delegate(persona.id, {
      id: 'b_legacy-cel', holderType: 'device', holderId: 'b_legacy-cel', holderName: 'Celular de Legado',
      maxDebit: A.cop(100_000), offlineCap: A.cop(10_000),
    })
    expect((await modosDe(persona.id)).map((m) => m.mode)).toEqual(['celular'])

    const res = await post(`/mandates/${persona.id}/modes`, {}, comoTitular())
    expect(res.json().created).toEqual(['asistente', 'sms'])
    expect(await getMandate('b_legacy-cel')).toMatchObject({ mode: 'celular', maxDebit: A.cop(40_000), offlineCap: A.cop(10_000) })
    expect(res.json().modes.map((m: Modo) => [m.mode, m.maxDebit.value])).toEqual([
      ['celular', A.cop(40_000).value],
      ['asistente', A.cop(20_000).value],
      ['sms', A.cop(20_000).value],
    ])
  })
})

describe('La demo de María', () => {
  it('tiene sus tres modos; su SMS es una rama del Asistente con su número', async () => {
    const modos = await modosDe('maria')
    expect(modos.map((m) => [m.mode, m.mandateId])).toEqual([
      ['celular', 'maria-device'],
      ['asistente', 'asistente-maria'],
      ['sms', 'maria-sms'],
    ])
    expect(modos[2].phone).toBe('+573001110002')
    expect(await getMandate('maria-sms')).toMatchObject({ holderType: 'agent', holderId: 'asistente' })
  })
})
