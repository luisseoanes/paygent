import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A, encodeVoucherSms, generateKeyPair, randomId, signVoucher, type DeviceCert } from '@openroute/shared'

// Agentes simulados: registra cada llamada para probar que el vale nunca llega al Asistente (LLM).
const agents = vi.hoisted(() => ({ paths: [] as string[] }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string) => {
    agents.paths.push(path)
    return path === '/assistant/message' ? { reply: 'respuesta del asistente' } : null
  },
}))

const { buildApp } = await import('../src/app.ts')
const store = { ...(await import('../src/store/offline.ts')) }
const { getMandate } = await import('../src/gateway/mandates.ts')
const { seed, PHONE_MAMA } = await import('../src/demo/seed.ts')
const { asUser } = await import('./helpers.ts')

const app = await buildApp({ logger: false })
const tienda = 'puntored:tienda' // Doña Rosa cobra por Puntored

beforeEach(async () => {
  await seed({ keepGrant: false })
  agents.paths = []
})

const sms = (Body: string) => app.inject({ method: 'POST', url: '/sms/inbound', payload: { From: '+573009998877', Body } })

const valeSms = async (pesos = 20_000) => {
  const device = generateKeyPair()
  const reg = await app.inject({ method: 'POST', url: '/mandates/maria-device/device-key', payload: { publicKey: device.publicKey }, headers: asUser('maria') })
  const cert = reg.json().cert as DeviceCert
  const v = signVoucher(
    {
      voucherId: randomId('v_'),
      deviceKeyId: cert.deviceKeyId,
      deviceCert: cert,
      merchantWallet: tienda,
      category: 'mercado',
      amount: A.cop(pesos),
      counter: 1,
      cumulative: A.cop(pesos),
      createdAt: new Date().toISOString(),
    },
    device.secretKey,
  )
  return encodeVoucherSms(v)
}

describe('vale por SMS (sin datos, solo señal de SMS)', () => {
  it('vale válido → liquidado por el mismo camino que /vouchers/settle', async () => {
    const res = await sms(await valeSms())
    expect(res.json().reply).toBe('Vale liquidado: $20.000 COP a Tienda Doña Rosa')
    expect((await store.listVouchers()).map((s) => s.status)).toEqual(['settled'])
    expect(agents.paths).toContain('/guardian/evaluate')
    expect(agents.paths).not.toContain('/assistant/message')
  })

  it('el mismo vale otra vez → rechazado por replay y el dispositivo queda congelado', async () => {
    const text = await valeSms()
    await sms(text)
    const res = await sms(text)
    expect(res.json().reply).toBe('Vale rechazado: este vale ya se había cobrado')
    expect((await getMandate('maria-device')).frozen).toBe(true)
  })

  it('texto basura con el prefijo → error amable, sin pasar por el Asistente', async () => {
    const res = await sms('VALE hola don')
    expect(res.json().reply).toMatch(/^No pude leer el vale/)
    expect(agents.paths).toEqual([])
  })

  it('un SMS normal sigue yendo al Asistente', async () => {
    const res = await app.inject({ method: 'POST', url: '/sms/inbound', payload: { From: PHONE_MAMA, Body: 'cuánto me queda?' } })
    expect(res.json().reply).toBe('respuesta del asistente')
    expect(agents.paths).toEqual(['/assistant/message'])
  })
})
