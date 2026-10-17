import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { HttpError } from '../src/gateway/errors.ts'

// Regresión: un 500 devolvía err.message tal cual (SQL, rutas, detalles de Open Payments).
const app = await buildApp({ logger: false })
app.get('/__boom', async () => {
  throw new Error('relation "secretos" does not exist')
})
app.get('/__http', async () => {
  throw new HttpError(503, 'El asistente no está disponible')
})

describe('errores hacia el cliente', () => {
  it('un error inesperado no expone su mensaje', async () => {
    const r = await app.inject({ method: 'GET', url: '/__boom' })
    expect(r.statusCode).toBe(500)
    expect(r.json().error).toMatch(/^Error interno \(req-/)
  })
  it('un HttpError conserva su mensaje, también si es 5xx', async () => {
    const r = await app.inject({ method: 'GET', url: '/__http' })
    expect(r.statusCode).toBe(503)
    expect(r.json().error).toBe('El asistente no está disponible')
  })
  it('un 400 de validación conserva su mensaje', async () => {
    const r = await app.inject({ method: 'POST', url: '/pay', payload: {}, headers: { 'x-api-key': 'dev-agents-key', 'x-agent-id': 'asistente' } })
    expect(r.statusCode).toBe(400)
    expect(r.json().error).toMatch(/body/)
  })
})
