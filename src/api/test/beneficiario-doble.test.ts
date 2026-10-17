import { describe, expect, it, vi } from 'vitest'

// Regresión: dos altas a la vez con el mismo código pasaban el chequeo de «rama libre» y la segunda le quitaba la rama
// a la primera. El chequeo de duplicados lento abre esa ventana a propósito.
vi.mock('../src/store/accounts.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/store/accounts.ts')>()
  return {
    ...real,
    findDuplicateUser: async (...a: Parameters<typeof real.findDuplicateUser>) => (await new Promise((r) => setTimeout(r, 50)), real.findDuplicateUser(...a)),
  }
})

const { buildApp } = await import('../src/app.ts')
const { seed } = await import('../src/demo/seed.ts')
const { asUser } = await import('./helpers.ts')
const app = await buildApp({ logger: false })

describe('Alta de beneficiario', () => {
  it('dos a la vez con el mismo código: entra uno, el otro recibe 409', async () => {
    await seed({ keepGrant: false })
    await app.inject({ method: 'POST', url: '/mandates/maria/revoke', headers: asUser('juan') }) // libera tope en la raíz
    const alta = await app.inject({
      method: 'POST',
      url: '/mandates/root/beneficiaries',
      headers: asUser('juan'),
      payload: { alias: 'Tío', maxDebit: { value: '10000000', assetCode: 'COP', assetScale: 2 }, offlineCap: { value: '1000000', assetCode: 'COP', assetScale: 2 }, pin: '1234' },
    })
    expect(alta.statusCode, alta.body).toBe(201)
    const { code } = alta.json()
    const registrar = (n: number) =>
      app.inject({
        method: 'POST',
        url: '/auth/register/beneficiario',
        payload: { documento: `99000${n}`, nombre: `Tío ${n}`, email: `tio${n}@x.dev`, telefono: `+57300000000${n}`, password: 'clave-larga', mandateId: code },
      })
    const r = await Promise.all([registrar(1), registrar(2)])
    expect(r.map((x) => x.statusCode).sort()).toEqual([201, 409])
  })
})
