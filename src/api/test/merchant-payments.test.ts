import { beforeEach, describe, expect, it } from 'vitest'
import { generateKeyPair, randomId, signVoucher, type Voucher } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { pesos } from '../src/demo/asset.ts'
import { seed } from '../src/demo/seed.ts'
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { asAgent, asUser } from './helpers.ts'

// La caja del tendero: lo que recibió su comercio, venga de un vale escaneado en cualquier celular o del Asistente.
const app = await buildApp({ logger: false })
beforeEach(() => seed({ keepGrant: false }))

const pagar = (merchantWallet: string, cop: number, reason: string) =>
  app
    .inject({
      method: 'POST',
      url: '/pay',
      headers: asAgent(),
      payload: { mandateId: 'asistente', merchantWallet, amount: pesos(cop), category: 'mercado', reason },
    })
    .then((r) => r.json())

const vale = async (cop: number) => {
  const keys = generateKeyPair()
  const reg = await app.inject({ method: 'POST', url: '/mandates/maria-device/device-key', payload: { publicKey: keys.publicKey }, headers: asUser('maria') })
  const { cert } = reg.json()
  const v: Voucher = signVoucher(
    {
      voucherId: randomId('v_'),
      deviceKeyId: cert.deviceKeyId,
      deviceCert: cert,
      merchantWallet: 'puntored:tienda',
      category: 'mercado',
      amount: pesos(cop),
      counter: 1,
      cumulative: pesos(cop),
      createdAt: new Date().toISOString(),
    },
    keys.secretKey,
  )
  return (await app.inject({ method: 'POST', url: '/vouchers/settle', payload: { vouchers: [v] } })).json().results[0]
}

const historial = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/merchants/tienda/payments', headers })

describe('GET /merchants/:id/payments', () => {
  it('trae los pagos del Asistente y los vales liquidados, los más nuevos primero, con lo que recibió el comercio', async () => {
    expect((await pagar('puntored:tienda', 8_000, 'arroz')).result).toBe('allow')
    expect((await vale(5_000)).status).toBe('settled')
    expect((await pagar(DEMO_WALLETS.farmacia, 12_000, 'losartán')).result).toBe('allow') // otro comercio

    const res = await historial(asUser('rosa'))
    expect(res.statusCode).toBe(200)
    const pagos = res.json() as { reason: string; status: string; received: unknown }[]
    expect(pagos.map((p) => p.reason)).toEqual(['Vale offline #1 de Celular de María', 'arroz'])
    expect(pagos.every((p) => p.status === 'completed')).toBe(true)
    expect(pagos.map((p) => p.received)).toEqual([pesos(5_000), pesos(8_000)])
  })

  it('cada tendero ve lo de su tienda: la farmacia, su compra; Rosa no la ve', async () => {
    expect((await pagar(DEMO_WALLETS.farmacia, 12_000, 'losartán')).result).toBe('allow')
    const farmacia = await app.inject({ method: 'GET', url: '/merchants/farmacia/payments', headers: asUser('tendero-farmacia') })
    expect(farmacia.json().map((p: { reason: string }) => p.reason)).toEqual(['losartán'])
    expect((await app.inject({ method: 'GET', url: '/merchants/farmacia/payments', headers: asUser('rosa') })).statusCode).toBe(403)
    expect((await historial(asUser('rosa'))).json()).toEqual([])
  })

  it('solo el tendero dueño del comercio', async () => {
    expect((await historial({})).statusCode).toBe(401)
    expect((await historial(asUser('juan'))).statusCode).toBe(403)
    expect((await historial(asAgent())).statusCode).toBe(403)
  })
})
