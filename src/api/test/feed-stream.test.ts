import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { emit } from '../src/feed/bus.ts'
import { issueToken } from '../src/auth/session.ts'

// El feed en vivo (SSE) de un titular solo trae lo de su árbol, nunca lo de otro titular.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })
const base = await app.listen({ port: 0, host: '127.0.0.1' })
afterAll(async () => {
  app.server.closeAllConnections()
  await app.close()
})

const titular = async (n: number) =>
  (
    await app.inject({
      method: 'POST',
      url: '/auth/register/titular',
      payload: {
        documento: `7100000${n}`,
        nombre: `Feed${n}`,
        apellido: 'Prueba',
        email: `feed${n}@correo.co`,
        telefono: `+5731100000${n}`,
        password: 'clave-segura',
        walletAddress: `$ilp.interledger-test.dev/feed-${n}`,
      },
    })
  ).json()

const ana = await titular(1)
const beto = await titular(2)
const evento = (mandateId: string, reason: string) =>
  emit({ mandateId, actor: { type: 'person', name: 'Prueba' }, kind: 'grant', reason })

describe('GET /feed/stream', () => {
  it('sin sesión o con la de otro titular → no abre el stream', async () => {
    expect((await app.inject(`/feed/stream?root=${ana.rootMandateId}`)).statusCode).toBe(401)
    const ajeno = await app.inject(`/feed/stream?root=${ana.rootMandateId}&token=${issueToken(beto.id)}`)
    expect(ajeno.statusCode).toBe(403)
  })

  it('emite en vivo los eventos del árbol del titular y no los de otro árbol', async () => {
    // Con algo en el historial el stream escribe al abrir y el fetch recibe las cabeceras.
    await evento(ana.rootMandateId, 'historial-de-ana')
    const ctrl = new AbortController()
    const res = await fetch(`${base}/feed/stream?root=${ana.rootMandateId}&token=${issueToken(ana.id)}`, { signal: ctrl.signal })
    expect(res.headers.get('content-type')).toBe('text/event-stream')

    const reader = res.body!.getReader()
    let recibido = ''
    const leerHasta = async (texto: string) => {
      while (!recibido.includes(texto)) recibido += new TextDecoder().decode((await reader.read()).value)
    }

    await leerHasta('historial-de-ana')
    await evento(beto.rootMandateId, 'evento-de-beto')
    await evento(ana.rootMandateId, 'evento-de-ana')
    await leerHasta('evento-de-ana')
    ctrl.abort()

    expect(recibido).not.toContain('evento-de-beto')
  })
})
