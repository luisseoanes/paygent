import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amount as A, generateKeyPair, randomId, signVoucher, type Voucher } from '@openroute/shared'

// El Guardián (Python) simulado: sube 50.000 si no hay alertas, baja a la mitad si hay alguna.
const guardian = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock('../src/lib/agents.ts', () => ({
  callAgents: async (path: string, body: any) => {
    guardian.calls.push(path)
    if (path === '/guardian/evaluate') return { decisions: body.vouchers.map((v: any) => ({ voucherId: v.voucherId, action: 'approve' })) }
    if (path === '/guardian/score') {
      const alerts = body.history.some((h: any) => h.status !== 'settled') || body.frozen
      const cap = BigInt(body.offlineCap.value)
      const top = BigInt(body.ceiling.value)
      const next = alerts ? cap / 2n : cap + 5_000_000n > top ? top : cap + 5_000_000n
      return { newCap: { ...body.offlineCap, value: String(next) }, explanation: alerts ? 'Bajé' : 'Subí' }
    }
    return null
  },
}))

const { buildApp } = await import('../src/app.ts')
const { seed } = await import('../src/demo/seed.ts')
const { getMandate } = await import('../src/gateway/mandates.ts')

const app = await buildApp({ logger: false })
beforeEach(async () => {
  await seed({ keepGrant: false })
  guardian.calls = []
})

const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload }).then((r) => r.json())

describe('Tope sin señal administrado por el Guardián', () => {
  it('al liquidar los vales de un celular, el Guardián ajusta su tope solo y el siguiente certificado ya lo trae', async () => {
    const keys = generateKeyPair()
    const { cert } = await post('/mandates/maria-device/device-key', { publicKey: keys.publicKey })
    expect(cert.offlineCap).toEqual(A.cop(80_000))

    const vale: Voucher = signVoucher(
      {
        voucherId: randomId('v_'),
        deviceKeyId: cert.deviceKeyId,
        deviceCert: cert,
        merchantWallet: 'puntored:tienda',
        category: 'mercado',
        amount: A.cop(10_000),
        counter: 1,
        cumulative: A.cop(10_000),
        createdAt: new Date().toISOString(),
      },
      keys.secretKey,
    )
    const { results } = await post('/vouchers/settle', { vouchers: [vale] })
    expect(results[0].status).toBe('settled')
    expect(guardian.calls).toContain('/guardian/score') // sin que nadie pulse "Revisar topes"
    expect((await getMandate('maria-device')).offlineCap).toEqual(A.cop(130_000))

    // Con señal, el celular pide un certificado nuevo: ya trae el tope nuevo para pagar sin señal
    const renewed = await post('/mandates/maria-device/device-key', { publicKey: keys.publicKey })
    expect(renewed.cert.offlineCap).toEqual(A.cop(130_000))

    // Replay: congela y, en la misma liquidación, el Guardián baja el tope
    await post('/vouchers/settle', { vouchers: [vale] })
    const m = await getMandate('maria-device')
    expect(m.frozen).toBe(true)
    expect(m.offlineCap).toEqual(A.cop(65_000))
    // Congelado: no se emiten certificados nuevos (la PWA deja de firmar vales)
    const blocked = await app.inject({ method: 'POST', url: '/mandates/maria-device/device-key', payload: { publicKey: keys.publicKey } })
    expect(blocked.statusCode).toBe(403)
  })
})
