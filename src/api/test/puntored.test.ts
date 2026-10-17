import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { recentEvents } from '../src/store/feed.ts'
import { asAgent, asUser } from './helpers.ts'

// Puntored no recibe pagos de Open Payments: el pago real llega a la wallet que lo representa y su acreditación al
// tendero (Bre-B) va simulada, con la misma forma que tendría la integración real. El tendero solo se registra.
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

let n = 0
const tendero = (extra: Record<string, string> = {}) => {
  n++
  return app.inject({
    method: 'POST',
    url: '/auth/register/tendero',
    payload: {
      documento: `8800${n}000`,
      nombre: 'Rosa',
      email: `tendero${n}@correo.co`,
      telefono: `+57 310 555 ${String(n).padStart(4, '0')}`,
      password: 'clave-segura',
      tienda: 'Tienda La Esquina',
      categoria: 'mercado',
      ...extra,
    },
  })
}
// El Asistente de la demo le paga al comercio (sin PIN: por debajo del umbral).
const pagar = (wallet: string, pesos = 12_000) =>
  app.inject({
    method: 'POST',
    url: '/pay',
    headers: asAgent(),
    payload: { mandateId: 'asistente', merchantWallet: wallet, amount: A.cop(pesos), category: 'mercado', reason: 'arroz y panela' },
  })
const acreditaciones = (merchantId: string, userId: string) =>
  app.inject({ method: 'GET', url: `/merchants/${merchantId}/credits`, headers: asUser(userId) })

describe('El tendero se registra y ya puede cobrar', () => {
  it('crea su cuenta y su tienda, que cobra por Puntored a su celular como llave Bre-B', async () => {
    const res = await tendero()
    expect(res.statusCode).toBe(201)
    const cuenta = res.json()
    expect(cuenta).toMatchObject({ role: 'tendero', merchantId: expect.any(String), token: expect.any(String) })
    const tienda = (await app.inject({ method: 'GET', url: '/merchants' })).json().find((m: { id: string }) => m.id === cuenta.merchantId)
    expect(tienda).toMatchObject({ name: 'Tienda La Esquina', category: 'mercado', wallet: `puntored:${cuenta.merchantId}`, payout: { via: 'puntored', llave: '3105550001' } })
    // Entra después con su correo y contraseña.
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'tendero1@correo.co', password: 'clave-segura' } })
    expect(login.json()).toMatchObject({ role: 'tendero', merchantId: cuenta.merchantId })
  })

  it('dos tiendas con el mismo nombre no chocan', async () => {
    const a = (await tendero()).json()
    const b = (await tendero()).json()
    expect(a.merchantId).not.toBe(b.merchantId)
  })

  it('puede dar otra llave Bre-B o cobrar en su propia wallet', async () => {
    expect((await tendero({ llave: '3001234567' })).json().merchantId).toBeTruthy()
    const conWallet = (await tendero({ wallet: 'https://ilp.interledger-test.dev/la-esquina' })).json()
    const tienda = (await app.inject({ method: 'GET', url: '/merchants' })).json().find((m: { id: string }) => m.id === conWallet.merchantId)
    expect(tienda).toMatchObject({ wallet: 'https://ilp.interledger-test.dev/la-esquina', payout: { via: 'wallet' } })
  })

  it('una llave que no es un celular colombiano se rechaza y no deja la cuenta a medias', async () => {
    const res = await tendero({ llave: '12345' })
    expect(res.statusCode).toBe(400)
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: `tendero${n}@correo.co`, password: 'clave-segura' } })
    expect(login.statusCode).toBe(401)
  })
})

describe('Puntored le acredita al tendero lo que recibe', () => {
  it('cada pago a la tienda queda acreditado a su llave, con referencia, y el titular lo ve', async () => {
    const cuenta = (await tendero()).json()
    expect((await pagar(`puntored:${cuenta.merchantId}`, 12_000)).json()).toMatchObject({ result: 'allow' })

    const [credito] = (await acreditaciones(cuenta.merchantId, cuenta.id)).json()
    const llave = `310•••${cuenta.telefono.slice(-4)}` // la del celular con que se registró, enmascarada
    expect(credito).toMatchObject({ estado: 'acreditado', pesos: 12_000, comisionPesos: 0, llave, ref: expect.stringMatching(/^BRB-/) })
    const feed = await recentEvents(10)
    expect(feed.some((e) => e.kind === 'payout' && /Puntored le acreditó \$12\.000 a Tienda La Esquina/.test(e.reason ?? ''))).toBe(true)
  })

  it('si la llave no existe en Bre-B, el dinero queda para retirar en su punto Puntored', async () => {
    const cuenta = (await tendero({ llave: '3100000000' })).json()
    await pagar(`puntored:${cuenta.merchantId}`)
    const [credito] = (await acreditaciones(cuenta.merchantId, cuenta.id)).json()
    expect(credito).toMatchObject({ estado: 'fallido', motivo: expect.stringMatching(/retirar en su punto Puntored/) })
  })

  it('una tienda que cobra en su wallet no pasa por Puntored', async () => {
    const cuenta = (await tendero({ wallet: 'https://ilp.interledger-test.dev/con-wallet' })).json()
    await pagar('https://ilp.interledger-test.dev/con-wallet')
    expect((await acreditaciones(cuenta.merchantId, cuenta.id)).json()).toEqual([])
  })

  it('solo el dueño de la tienda ve sus acreditaciones', async () => {
    const cuenta = (await tendero()).json()
    expect((await acreditaciones(cuenta.merchantId, 'maria')).statusCode).toBe(403)
  })

  it('un pago que falla no se acredita', async () => {
    const cuenta = (await tendero()).json()
    // Supera el tope de la rama: el gateway lo niega y no se mueve dinero.
    expect((await pagar(`puntored:${cuenta.merchantId}`, 9_000_000)).json()).toMatchObject({ result: 'deny' })
    expect((await acreditaciones(cuenta.merchantId, cuenta.id)).json()).toEqual([])
  })
})
