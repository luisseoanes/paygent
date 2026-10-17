import { beforeEach, describe, expect, it } from 'vitest'
import { amount as A, generateKeyPair, randomId, signVoucher, type DeviceCert, type Voucher } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { asUser } from './helpers.ts'

// Regresión: el acumulado solo se cotejaba con el vale anterior si existía. Saltando contadores (o fechando el vale
// fuera de la vigencia del certificado) un celular gastaba sin señal más que su tope.
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const enlazar = async () => {
  const device = generateKeyPair()
  const reg = await app.inject({ method: 'POST', url: '/mandates/maria-device/device-key', payload: { publicKey: device.publicKey }, headers: asUser('maria') })
  const cert = reg.json().cert as DeviceCert
  const vale = (counter: number, amount: A.Asset & { value: string }, cumulative: typeof amount, createdAt = new Date().toISOString()): Voucher =>
    signVoucher(
      {
        voucherId: randomId('v_'),
        deviceKeyId: cert.deviceKeyId,
        deviceCert: cert,
        merchantWallet: 'https://ilp.interledger-test.dev/dona-rosa',
        category: 'mercado',
        amount,
        counter,
        cumulative,
        createdAt,
      },
      device.secretKey,
    )
  return { cert, vale }
}
const liquidar = (vouchers: Voucher[]) =>
  app
    .inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers } })
    .then((r) => r.json().results as { voucherId: string; status: string; reason?: string }[])
    // los rechazados se anotan antes que los liquidados: se devuelven en el orden de los vales
    .then((rs) => vouchers.map((v) => rs.find((x) => x.voucherId === v.voucherId)!))

describe('Tope sin señal por certificado', () => {
  it('saltando contadores no se gasta más que el tope del certificado', async () => {
    const { cert, vale } = await enlazar()
    const cap = cert.offlineCap
    const r = await liquidar([vale(1, cap, cap), vale(3, cap, cap)])
    expect(r.map((x) => x.status)).toEqual(['settled', 'rejected'])
    expect(r[1].reason).toMatch(/tope sin señal/)
  })

  it('en lotes separados, tampoco', async () => {
    const { cert, vale } = await enlazar()
    const half = A.percent(cert.offlineCap, 60)
    expect((await liquidar([vale(1, half, half)]))[0].status).toBe('settled')
    expect((await liquidar([vale(5, half, half)]))[0]).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/tope sin señal/) })
  })

  it('un vale fechado antes de emitirse el certificado o en el futuro se rechaza', async () => {
    const { cert, vale } = await enlazar()
    const poco = A.percent(cert.offlineCap, 10)
    const antes = new Date(new Date(cert.issuedAt).getTime() - 3600_000).toISOString()
    const futuro = new Date(Date.now() + 3600_000).toISOString()
    const r = await liquidar([vale(1, poco, poco, antes), vale(2, poco, A.add(poco, poco), futuro)])
    expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected'])
    expect(r.every((x) => /fecha/i.test(x.reason ?? ''))).toBe(true)
  })

  it('vales seguidos dentro del tope se liquidan como siempre', async () => {
    const { cert, vale } = await enlazar()
    const a = A.percent(cert.offlineCap, 30)
    const b = A.percent(cert.offlineCap, 50)
    expect((await liquidar([vale(1, a, a), vale(2, b, A.add(a, b))])).map((x) => x.status)).toEqual(['settled', 'settled'])
  })
})
