import { describe, expect, it } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { delegate, getMandate, putMandate, rollPeriod } from '../src/gateway/mandates.ts'
import { sql } from '../src/store/sql.ts'

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
const alta = (alias: string, offlineCap = 10_000, maxDebit = 100_000) =>
  post(`/mandates/${titular.rootMandateId}/beneficiaries`, { alias, maxDebit: A.cop(maxDebit), offlineCap: A.cop(offlineCap), pin: '246810' })
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

describe('El número del SMS va en E.164', () => {
  it('una cuenta con el celular sin indicativo queda hablando como +57…', async () => {
    const { code, mandateId } = (await alta('Novia', 1_000, 10_000)).json()
    await post('/auth/register/beneficiario', {
      documento: '71000077', nombre: 'Novia', email: 'novia@correo.co', telefono: '3052100077', password: 'clave-segura', mandateId: code,
    })
    expect((await modosDe(mandateId)).find((m) => m.mode === 'sms')?.phone).toBe('+573052100077')
    expect((await get('/sms/profile?phone=%2B573052100077')).statusCode).toBe(200)
  })

  it('volver a habilitar arregla un perfil guardado sin indicativo (altas anteriores)', async () => {
    const { code, mandateId } = (await alta('Novia 2', 1_000, 10_000)).json()
    await post('/auth/register/beneficiario', {
      documento: '71000078', nombre: 'Novia 2', email: 'novia2@correo.co', telefono: '3052100078', password: 'clave-segura', mandateId: code,
    })
    await sql().query(`update profiles set channel = '3052100078' where channel = '+573052100078'`)
    await post(`/mandates/${mandateId}/modes`, {}, comoTitular())
    expect((await get('/sms/profile?phone=%2B573052100078')).statusCode).toBe(200)
    expect((await get('/sms/profile?phone=3052100078')).statusCode).toBe(404)
  })

  it('no pisa el número que el titular eligió para el SMS', async () => {
    const { code, mandateId } = (await alta('Novia 3', 1_000, 10_000)).json()
    await post('/auth/register/beneficiario', {
      documento: '71000079', nombre: 'Novia 3', email: 'novia3@correo.co', telefono: '3052100079', password: 'clave-segura', mandateId: code,
    })
    await app.inject({ method: 'PUT', url: `/mandates/${mandateId}/sms`, payload: { phone: '3052100080', pin: '2580' }, headers: comoTitular() })
    await post(`/mandates/${mandateId}/modes`, {}, comoTitular())
    expect((await get('/sms/profile?phone=%2B573052100080')).statusCode).toBe(200)
    expect((await get('/sms/profile?phone=%2B573052100079')).statusCode).toBe(404)
    expect((await modosDe(mandateId)).find((m) => m.mode === 'sms')?.phone).toBe('+573052100080')
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

describe('El titular reparte el tope entre los modos de una vez (PATCH /mandates/:persona/modes)', () => {
  const reparto = (id: string, limits: object[], headers: Record<string, string> = comoTitular()) =>
    app.inject({ method: 'PATCH', url: `/mandates/${id}/modes`, payload: { limits }, headers })

  it('da lo que hace falta para repartir: tope de la persona, reservado, mínimo y gastado por modo', async () => {
    const { mandateId } = (await alta('Ahijada', 1_000, 10_000)).json()
    const res = (await get(`/mandates/${mandateId}/modes`)).json()
    expect(res).toMatchObject({ personaName: 'Ahijada', budget: A.cop(10_000), reserved: A.cop(0) })
    const chat = res.modes.find((m: Modo) => m.mode === 'asistente')
    expect(chat).toMatchObject({ minDebit: A.cop(2_000), spent: A.cop(0) })
  })

  it('sube uno con lo que baja otro en la misma petición, sin importar el orden', async () => {
    const { mandateId } = (await alta('Comadre', 1_000, 10_000)).json()
    const [cel, chat] = await modosDe(mandateId)
    // 4.000 / 2.000 / 2.000 con 2.000 libres: subir el Asistente a 7.000 solo cabe si antes baja el celular.
    const res = await reparto(mandateId, [
      { mandateId: chat.mandateId, maxDebit: A.cop(7_000) },
      { mandateId: cel.mandateId, maxDebit: A.cop(1_000) },
    ])
    expect(res.statusCode).toBe(200)
    expect(res.json().modes.map((m: Modo) => m.maxDebit.value)).toEqual([A.cop(1_000).value, A.cop(7_000).value, A.cop(2_000).value])
  })

  it('todo o nada: si el reparto no cabe, no cambia ningún modo', async () => {
    const { mandateId } = (await alta('Compadre', 1_000, 10_000)).json()
    const [cel, chat] = await modosDe(mandateId)
    const res = await reparto(mandateId, [
      { mandateId: cel.mandateId, maxDebit: A.cop(1_000) },
      { mandateId: chat.mandateId, maxDebit: A.cop(9_000) },
    ])
    expect(res.statusCode).toBe(403)
    expect((await modosDe(mandateId)).map((m) => m.maxDebit.value)).toEqual([A.cop(4_000).value, A.cop(2_000).value, A.cop(2_000).value])
  })

  it('el tope de la persona sube hasta lo que su titular aún no repartió, y con él lo libre', async () => {
    const { mandateId } = (await alta('Prima segunda', 1_000, 10_000)).json()
    const { budget, budgetMax, modes } = (await get(`/mandates/${mandateId}/modes`)).json()
    expect(BigInt(budgetMax.value)).toBeGreaterThan(BigInt(budget.value))
    const [, chat] = modes as Modo[]
    // Sube la persona al máximo y, en la misma petición, el Asistente con lo que se liberó.
    const extra = BigInt(budgetMax.value) - BigInt(budget.value)
    const res = (
      await app.inject({
        method: 'PATCH', url: `/mandates/${mandateId}/modes`, headers: comoTitular(),
        payload: { budget: budgetMax, limits: [{ mandateId: chat.mandateId, maxDebit: { ...budget, value: String(2_000_00n + extra) } }] },
      })
    ).json()
    expect(res.budget).toEqual(budgetMax)
    expect(res.modes[1].maxDebit.value).toBe(String(2_000_00n + extra))
    const pasado = await app.inject({
      method: 'PATCH', url: `/mandates/${mandateId}/modes`, headers: comoTitular(),
      payload: { budget: { ...budgetMax, value: String(BigInt(budgetMax.value) + 1n) }, limits: [] },
    })
    expect(pasado.statusCode).toBe(403)
    // Y de vuelta: la persona y el Asistente bajan juntos (deja lo libre de la raíz para los demás tests).
    const vuelta = await app.inject({
      method: 'PATCH', url: `/mandates/${mandateId}/modes`, headers: comoTitular(),
      payload: { budget, limits: [{ mandateId: chat.mandateId, maxDebit: chat.maxDebit }] },
    })
    expect(vuelta.json().budget).toEqual(budget)
  })

  it('bajar a la persona por debajo de lo repartido solo cabe si los modos bajan en la misma petición', async () => {
    const { mandateId } = (await alta('Tío abuelo', 1_000, 10_000)).json()
    const [cel, chat, sms] = await modosDe(mandateId)
    // 4.000 + 2.000 + 2.000 repartidos de 10.000: bajar a 5.000 sin tocar los modos no cabe.
    const sola = await reparto(mandateId, [], comoTitular())
    expect(sola.statusCode).toBe(400)
    const noCabe = await app.inject({
      method: 'PATCH', url: `/mandates/${mandateId}/modes`, headers: comoTitular(), payload: { budget: A.cop(5_000), limits: [] },
    })
    expect(noCabe.statusCode).toBe(403)
    expect((await getMandate(mandateId)).maxDebit).toEqual(A.cop(10_000))
    const cabe = await app.inject({
      method: 'PATCH', url: `/mandates/${mandateId}/modes`, headers: comoTitular(),
      payload: {
        budget: A.cop(5_000),
        limits: [
          // El Asistente y el SMS no bajan de 2.000: es lo que ya repartieron a su consulta al Inventario.
          { mandateId: cel.mandateId, maxDebit: A.cop(1_000) },
          { mandateId: chat.mandateId, maxDebit: A.cop(2_000) },
          { mandateId: sms.mandateId, maxDebit: A.cop(2_000) },
        ],
      },
    })
    expect(cabe.statusCode).toBe(200)
    expect(cabe.json().budget).toEqual(A.cop(5_000))
  })

  it('solo modos de esa persona y solo su titular', async () => {
    const { mandateId } = (await alta('Padrino', 1_000, 10_000)).json()
    expect((await reparto(mandateId, [{ mandateId: 'maria-device', maxDebit: A.cop(1) }])).statusCode).toBe(400)
    const [cel] = await modosDe(mandateId)
    expect((await reparto(mandateId, [{ mandateId: cel.mandateId, maxDebit: A.cop(1) }], {})).statusCode).toBe(401)
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

// La billetera enlaza el celular, pero lo que la persona puede gastar es su rama entera (todos sus modos).
describe('Lo que le queda a la persona (remaining de GET /mandates/:id/modes)', () => {
  it('desde la rama del celular se ve el saldo de la persona, no solo el del celular', async () => {
    const res = (await get('/mandates/maria-device/modes')).json()
    expect(res.personaId).toBe('maria')
    expect(res.remaining).toEqual(A.cop(1_000_000))
    expect(res.modes[0]).toMatchObject({ mode: 'celular', remaining: A.cop(400_000) })
  })

  it('descuenta lo gastado por cualquier modo y nunca supera lo que le queda a quien la delegó', async () => {
    const { code, mandateId } = (await alta('Abuela', 10_000, 100_000)).json()
    const persona = rollPeriod(await getMandate(mandateId))
    await putMandate({ ...persona, spentInPeriod: A.cop(30_000) })
    expect((await get(`/mandates/${code}/modes`)).json().remaining).toEqual(A.cop(70_000))
    const root = rollPeriod(await getMandate(titular.rootMandateId))
    await putMandate({ ...root, spentInPeriod: A.sub(root.maxDebit, A.cop(5_000)) })
    expect((await get(`/mandates/${code}/modes`)).json().remaining).toEqual(A.cop(5_000))
    await putMandate(root)
  })
})
