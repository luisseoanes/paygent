import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A, generateKeyPair } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { issueToken, verifyToken } from '../src/auth/session.ts'
import { seed } from '../src/demo/seed.ts'
import { asAgent, asUser } from './helpers.ts'

// Quién puede hacer qué: sin sesión firmada nadie toca un árbol, y cada titular solo el suyo.
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, headers: Record<string, string> = {}, payload?: object) =>
  app.inject({ method, url, headers, payload })
const device = { holderType: 'device', holderId: 'atacante', maxDebit: A.cop(1_000), offlineCap: A.cop(1_000) }

describe('Token de sesión', () => {
  it('firmado por la api: alterado, vencido o inventado no vale', () => {
    const t = issueToken('juan')
    expect(verifyToken(t)).toBe('juan')
    const [payload, mac] = t.split('.')
    const otro = Buffer.from(JSON.stringify({ sub: 'maria', exp: Date.now() + 1e9 })).toString('base64url')
    expect(verifyToken(`${otro}.${mac}`)).toBeUndefined()
    expect(verifyToken(`${payload}.x${mac.slice(1)}`)).toBeUndefined()
    expect(verifyToken(issueToken('juan', Date.now() - 8 * 24 * 3600_000))).toBeUndefined()
  })

  it('el login lo entrega y x-user-id ya no identifica a nadie', async () => {
    const login = (await call('POST', '/auth/login', {}, { email: 'juan@paygent.dev', password: 'paygent123' })).json()
    expect(verifyToken(login.token)).toBe('juan')
    expect((await call('POST', '/mandates/maria/unfreeze', { 'x-user-id': 'juan' })).statusCode).toBe(401)
    expect((await call('POST', '/mandates/maria/unfreeze', { authorization: `Bearer ${login.token}` })).statusCode).toBe(200)
  })
})

describe('Sin sesión no se toca ningún árbol', () => {
  it.each([
    ['POST', '/mandates/root/delegate', device],
    ['POST', '/mandates/maria/revoke', undefined],
    ['POST', '/mandates/maria/unfreeze', undefined],
    ['PATCH', '/mandates/maria/limits', { maxDebit: A.cop(1) }],
    ['POST', '/mandates/maria-device/device-key', { publicKey: generateKeyPair().publicKey }],
    ['POST', '/mandates/root/beneficiaries', { alias: 'X' }],
    ['PUT', '/delivery-address/root', { recipientName: 'X', address: 'Y' }],
    ['POST', '/merchants', { name: 'Comercio Atacante', category: 'mercado', wallet: 'https://w/atacante' }],
    ['POST', '/mandates/root', {}],
    ['POST', '/demo/reset', {}],
    ['GET', '/feed', undefined],
    ['GET', '/mandates/maria', undefined],
    ['GET', '/mandates/root/tree', undefined],
    ['GET', '/merchants/tienda/payments', undefined],
  ] as const)('%s %s → 401', async (method, url, payload) => {
    expect((await call(method, url, {}, payload)).statusCode).toBe(401)
  })

  it('el perfil de un celular solo lo lee el servicio de agentes', async () => {
    expect((await call('GET', '/sms/profile?phone=%2B573001112233', asUser('juan'))).statusCode).toBe(401)
    expect((await call('GET', '/sms/profile?phone=%2B573001112233')).statusCode).toBe(401)
    expect((await call('GET', '/sms/profile?phone=%2B573001112233', asAgent())).statusCode).toBe(200)
  })
})

describe('Cada quien en lo suyo', () => {
  it('otra cuenta no delega, revoca ni lee el árbol de Juan', async () => {
    expect((await call('POST', '/mandates/root/delegate', asUser('rosa'), device)).statusCode).toBe(403)
    expect((await call('POST', '/mandates/maria/revoke', asUser('rosa'))).statusCode).toBe(403)
    expect((await call('GET', '/mandates/root/tree', asUser('rosa'))).statusCode).toBe(403)
    expect((await call('GET', '/feed?root=root', asUser('maria'))).statusCode).toBe(403)
  })

  it('la beneficiaria pide el certificado de SU celular y lee su rama; no la de otra persona', async () => {
    const pk = { publicKey: generateKeyPair().publicKey }
    expect((await call('POST', '/mandates/maria-device/device-key', asUser('maria'), pk)).statusCode).toBe(200)
    expect((await call('GET', '/mandates/maria-device', asUser('maria'))).statusCode).toBe(200)
    expect((await call('GET', '/mandates/asistente', asUser('maria'))).statusCode).toBe(403)
    // Delegar sigue siendo del titular, aunque la rama sea suya.
    expect((await call('POST', '/mandates/maria/delegate', asUser('maria'), device)).statusCode).toBe(403)
  })

  it('un agente no hace lo que decide una persona', async () => {
    expect((await call('POST', '/mandates/maria/revoke', asAgent())).statusCode).toBe(403)
    expect((await call('POST', '/mandates/maria-device/device-key', asAgent(), { publicKey: 'x' })).statusCode).toBe(403)
    expect((await call('POST', '/demo/reset', asAgent(), {})).statusCode).toBe(403)
  })
})
