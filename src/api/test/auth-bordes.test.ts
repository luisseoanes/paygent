import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'

const app = await buildApp({ logger: false })

describe('Bordes de autenticación', () => {
  // Regresión: se comparaba la longitud del texto, no la de los bytes; una clave con «ñ» hacía saltar timingSafeEqual (500).
  it('una x-api-key con caracteres no ASCII de la misma longitud → 401', async () => {
    const key = 'ñ'.repeat('dev-agents-key'.length)
    const r = await app.inject({ method: 'GET', url: '/vouchers', headers: { 'x-api-key': key, 'x-agent-id': 'asistente' } })
    expect(r.statusCode).toBe(401)
  })
})
