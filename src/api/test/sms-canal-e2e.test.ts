import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { amount as A } from '@openroute/shared'

// De punta a punta con el servicio Python de agentes de verdad (MOCK_OP=1, MOCK_LLM=1): un número registrado por
// un titular (no el de la semilla) habla por /sms/inbound con el Asistente, que paga por /pay con PIN.
const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => ok(port))
    })
  })

const apiPort = await freePort()
const agentsPort = await freePort()
process.env.AGENTS_URL = `http://127.0.0.1:${agentsPort}`
const { buildApp } = await import('../src/app.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')
const { asUser } = await import('./helpers.ts')

const app = await buildApp({ logger: false })
let agents: ChildProcess

const waitHealth = async (url: string, ms = 60_000) => {
  for (const until = Date.now() + ms; Date.now() < until; await new Promise((r) => setTimeout(r, 300)))
    if (await fetch(url).then((r) => r.ok).catch(() => false)) return
  throw new Error(`${url} no respondió`)
}

beforeAll(async () => {
  await app.listen({ port: apiPort, host: '127.0.0.1' })
  agents = spawn('uv', ['run', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(agentsPort)], {
    cwd: resolve(import.meta.dirname, '../../agents'),
    env: { ...process.env, API_URL: `http://127.0.0.1:${apiPort}`, MOCK_LLM: '1', ANTHROPIC_API_KEY: '', MOCK_INVENTORY_PAYMENT: '0' },
    stdio: 'ignore',
  })
  await waitHealth(`http://127.0.0.1:${agentsPort}/health`)
}, 90_000)

afterAll(async () => {
  agents?.kill()
  await app.close()
})

const post = (url: string, payload: object, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url, payload, headers })

describe('SMS de una rama registrada por un titular', () => {
  it('pedido por SMS → PIN → pago real en la rama del Asistente', async () => {
    const hijo = (
      await post('/auth/register/titular', {
        documento: '72000001', nombre: 'Andrés', apellido: 'Prueba', email: 'andres@correo.co', telefono: '+573120000001',
        password: 'clave-segura', walletAddress: '$ilp.interledger-test.dev/andres',
      })
    ).json()
    // Andrés firma su grant (en mock) y registra a su mamá; el SMS se activa en el celular de ella.
    const { redirectUrl } = (await post('/mandates/root', { rootMandateId: hijo.rootMandateId }, asUser(hijo.id))).json()
    await app.inject({ method: 'GET', url: new URL(redirectUrl).pathname + new URL(redirectUrl).search })
    await app.inject({
      method: 'PUT', url: `/delivery-address/${hijo.rootMandateId}`, payload: { recipientName: 'Gloria', address: 'Calle 10 # 4-21' }, headers: asUser(hijo.id),
    })
    const mama = (
      await post(`/mandates/${hijo.rootMandateId}/beneficiaries`, { alias: 'Gloria', maxDebit: A.cop(300_000), offlineCap: A.cop(50_000), pin: '4321' }, asUser(hijo.id))
    ).json()
    const activo = await app.inject({
      method: 'PUT', url: `/mandates/${mama.deviceMandateId}/sms`, payload: { phone: '310 222 3344', pin: '2580' }, headers: asUser(hijo.id),
    })
    expect(activo.statusCode).toBe(200)
    const { mandateId } = activo.json()

    // El número llega como lo manda el operador (E.164).
    const sms = async (Body: string) => (await post('/sms/inbound', { From: '+573102223344', Body })).json().reply as string
    let reply = await sms('necesito la pastilla de la presión')
    if (/1 para recogerlo/.test(reply)) reply = await sms('1')
    expect(reply).toMatch(/PIN/)
    expect(await sms('0000')).toMatch(/incorrecto/i)
    reply = await sms('2580')
    expect(reply).toMatch(/código/i)

    const asistente = await getMandate(mandateId)
    expect(BigInt(asistente.spentInPeriod.value)).toBeGreaterThan(0n)
    expect((await getMandate(hijo.rootMandateId)).spentInPeriod).not.toEqual(A.cop(0))
  }, 60_000)
})
