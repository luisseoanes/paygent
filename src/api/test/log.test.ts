import { describe, expect, it } from 'vitest'
import { redactUrl } from '../src/http/log.ts'

// Regresión: Fastify registraba la url completa y el SSE lleva el token de sesión en ?token=.
describe('logs sin token de sesión', () => {
  it('tapa ?token= y &token=, y deja el resto de la url', () => {
    expect(redactUrl('/feed/stream?token=abc.def&root=r1')).toBe('/feed/stream?token=[oculto]&root=r1')
    expect(redactUrl('/feed/stream?root=r1&token=abc.def')).toBe('/feed/stream?root=r1&token=[oculto]')
    expect(redactUrl('/mandates/m1?x=1')).toBe('/mandates/m1?x=1')
  })
})
