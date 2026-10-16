import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { getActiveGrant, getMerchant, payerOfRoot } from '../src/db.ts'
import { DEMO_PASSWORD, seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { sql } from '../src/store/sql.ts'

// Modelo de datos en Postgres: cuentas, quien delega con su grant, comercios y agentes como filas.
const app = await buildApp({ logger: false })
const service = { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' }

beforeEach(() => seed({ keepGrant: false }))

const login = (email: string, password: string) => app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })

describe('Cuentas', () => {
  it('Juan entra como quien delega, con su wallet y su mandato raíz', async () => {
    const res = await login('juan@paygent.dev', DEMO_PASSWORD)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      role: 'titular',
      user: { id: 'juan', name: 'Juan Pérez', documentNumber: '1017000001' },
      walletAddress: DEMO_WALLETS.juan,
      rootMandateId: 'root',
    })
  })

  it('María entra como beneficiaria y ve sus ramas', async () => {
    const res = await login('MARIA@paygent.dev', DEMO_PASSWORD)
    expect(res.json()).toMatchObject({ role: 'beneficiario', rootMandateId: null, mandateIds: ['maria', 'maria-device', 'maria-sms'] })
  })

  it('la tendera entra con su tienda', async () => {
    expect((await login('tendero@paygent.dev', DEMO_PASSWORD)).json()).toMatchObject({ role: 'tendero', merchantId: 'tienda' })
  })

  it('contraseña incorrecta o cuenta sin contraseña (Doña Carmen solo usa SMS) → 401', async () => {
    expect((await login('juan@paygent.dev', 'otra-clave')).statusCode).toBe(401)
    expect((await login('nadie@paygent.dev', DEMO_PASSWORD)).statusCode).toBe(401)
  })

  it('la contraseña no se guarda en claro', async () => {
    const [u] = await sql().query(`select password_hash from users where id = 'juan'`)
    expect(u.password_hash).not.toContain(DEMO_PASSWORD)
    expect(u.password_hash).toHaveLength(64)
  })
})

describe('Comercios: se dan de alta por la api, sin variables de entorno', () => {
  it('con su wallet pública', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/merchants',
      payload: { name: 'Droguería La Esperanza', category: 'farmacia', wallet: 'https://ilp.interledger-test.dev/drogueria-esperanza' },
    })
    expect(res.statusCode).toBe(201)
    expect(await getMerchant('drogueria-la-esperanza')).toMatchObject({ wallet: 'https://ilp.interledger-test.dev/drogueria-esperanza' })
  })

  it('sin wallet, cobrando por Puntored', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/merchants',
      payload: { id: 'tienda-pepe', name: 'Tienda Pepe', category: 'mercado', payout: { via: 'puntored', llave: '3001234567' } },
    })
    expect(res.json()).toMatchObject({ wallet: 'puntored:tienda-pepe', payout: { via: 'puntored', llave: '3001234567' } })
  })

  it('una wallet repetida, datos inválidos o un agente → rechazado', async () => {
    const dup = { name: 'Otra', category: 'farmacia', wallet: DEMO_WALLETS.farmacia }
    expect((await app.inject({ method: 'POST', url: '/merchants', payload: dup })).statusCode).toBe(409)
    expect((await app.inject({ method: 'POST', url: '/merchants', payload: { name: 'X', category: 'ropa' } })).statusCode).toBe(400)
    const asAgent = await app.inject({ method: 'POST', url: '/merchants', headers: service, payload: { name: 'X', category: 'mercado' } })
    expect(asAgent.statusCode).toBe(403)
  })
})

describe('Agentes: filas de la tabla, una sola credencial para el servicio', () => {
  it('un agente nuevo se da de alta sin clave propia', async () => {
    const res = await app.inject({ method: 'POST', url: '/agents', payload: { name: 'Asistente de Pedro', role: 'assistant' } })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ id: 'asistente-de-pedro', name: 'Asistente de Pedro', role: 'assistant' })
  })

  it('credencial del servicio incorrecta o agente desconocido → 401', async () => {
    const body = { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, amount: A.cop(4000), category: 'farmacia', reason: 'x' }
    const pay = (headers: Record<string, string>) => app.inject({ method: 'POST', url: '/pay', headers, payload: body })
    expect((await pay({ 'x-api-key': 'dev-assistant-key', 'x-agent-id': 'asistente' })).statusCode).toBe(401)
    expect((await pay({ ...service, 'x-agent-id': 'fantasma' })).statusCode).toBe(401)
    expect((await pay(service)).json().result).toBe('allow')
  })

  it('el Guardián no puede pagar con el mandato del Asistente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pay',
      headers: { ...service, 'x-agent-id': 'guardian' },
      payload: { mandateId: 'asistente', merchantWallet: DEMO_WALLETS.farmacia, amount: A.cop(4000), category: 'farmacia', reason: 'x' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('El grant de quien delega sobrevive a la semilla', () => {
  it('al volver a sembrar se conserva y queda enlazado a Juan', async () => {
    await sql().query(
      `insert into root_grants (id, root_mandate_id, payer_id, status, wallet_address, max_debit, interval, continue_uri,
         continue_token, access_token, manage_url)
       values ('g1', 'root', 'juan', 'active', $1, '{}'::jsonb, 'P1M', 'c', 'ct', 't', 'm')`,
      [DEMO_WALLETS.juan],
    )
    await seed({ keepGrant: true })
    expect((await getActiveGrant('root'))?.id).toBe('g1')
    const [g] = await sql().query(`select payer_id from root_grants where id = 'g1'`)
    expect(g.payer_id).toBe('juan')
    expect((await payerOfRoot('root'))?.walletAddress).toBe(DEMO_WALLETS.juan)

    await seed({ keepGrant: false })
    expect(await getActiveGrant('root')).toBeNull()
  })
})
