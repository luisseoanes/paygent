import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { DEMO_PASSWORD } from '../src/demo/seed.ts'

// Regresión: el login no tenía tope de intentos (y scrypt síncrono bloqueaba la api en cada uno).
const app = await buildApp({ logger: false })
const login = (password: string, ip: string) =>
  app.inject({ method: 'POST', url: '/auth/login', headers: { 'x-forwarded-for': ip }, payload: { email: 'juan@paygent.dev', password } })

describe('Login con tope de intentos', () => {
  it('5 fallos desde una IP la frenan, también con la contraseña buena; otra IP entra', async () => {
    for (let i = 0; i < 5; i++) expect((await login('mala-clave', '203.0.113.7')).statusCode).toBe(401)
    expect((await login(DEMO_PASSWORD, '203.0.113.7')).statusCode).toBe(429)
    expect((await login(DEMO_PASSWORD, '198.51.100.9')).statusCode).toBe(200)
  })

  it('un acierto antes del tope reinicia la cuenta', async () => {
    for (let i = 0; i < 4; i++) await login('mala-clave', '192.0.2.1')
    expect((await login(DEMO_PASSWORD, '192.0.2.1')).statusCode).toBe(200)
    for (let i = 0; i < 4; i++) expect((await login('mala-clave', '192.0.2.1')).statusCode).toBe(401)
  })
})
