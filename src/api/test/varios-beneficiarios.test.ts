import { describe, expect, it } from 'vitest'
import { amount as A, type Amount } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { treeOf } from '../src/gateway/mandates.ts'
import { asUser } from './helpers.ts'

// Varios beneficiarios compiten por el mismo mandato: el máximo de cada uno sale de lo que tienen los demás, y la
// suma de sus topes nunca supera la raíz.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })

let sesion = {}
const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: sesion })
const titular = (
  await post('/auth/register/titular', {
    documento: '93000001', nombre: 'Pedro', apellido: 'Gómez', email: 'pedro.varios@correo.co', telefono: '+573009990003',
    password: 'clave-segura', walletAddress: '$ilp.interledger-test.dev/pedro-varios',
  })
).json()
const raiz = titular.rootMandateId as string // 1.200.000 COP
const comoTitular = asUser(titular.id)
sesion = comoTitular
const alta = async (alias: string, pesos: number) =>
  (await post(`/mandates/${raiz}/beneficiaries`, { alias, maxDebit: A.cop(pesos), offlineCap: A.cop(1_000), pin: '246810' })).json()
    .mandateId as string
const modos = async (id: string) => (await app.inject({ method: 'GET', url: `/mandates/${id}/modes`, headers: comoTitular })).json()
const tope = (id: string, budget: Amount) =>
  app.inject({ method: 'PATCH', url: `/mandates/${id}/modes`, headers: comoTitular, payload: { budget, limits: [] } })
const sumaRaiz = async () => (await treeOf(raiz)).children.filter((c) => !c.revoked).reduce((n, c) => n + BigInt(c.maxDebit.value), 0n)

describe('Varios beneficiarios del mismo mandato', () => {
  it('el máximo de cada uno se recalcula con lo que tienen los demás', async () => {
    const novia = await alta('Novia', 200_000)
    const mama = await alta('Mamá', 300_000)
    // 1.200.000 − lo de la otra persona.
    expect((await modos(novia)).budgetMax).toEqual(A.cop(900_000))
    expect((await modos(mama)).budgetMax).toEqual(A.cop(1_000_000))

    // Novia sube a 600.000: el máximo de Mamá baja a 600.000.
    expect((await tope(novia, A.cop(600_000))).statusCode).toBe(200)
    expect((await modos(mama)).budgetMax).toEqual(A.cop(600_000))

    // Mamá no puede pasar de ahí, aunque su modal viejo dijera 1.000.000: todo o nada.
    expect((await tope(mama, A.cop(700_000))).statusCode).toBe(403)
    expect((await modos(mama)).budget).toEqual(A.cop(300_000))
    expect((await tope(mama, A.cop(600_000))).statusCode).toBe(200)

    // La raíz queda exactamente llena y nadie puede subir más.
    expect(await sumaRaiz()).toBe(BigInt(A.cop(1_200_000).value))
    expect((await modos(novia)).budgetMax).toEqual(A.cop(600_000))
    expect((await tope(novia, A.cop(600_001))).statusCode).toBe(403)
  })

  it('un beneficiario nuevo solo cabe en lo que queda libre', async () => {
    expect((await post(`/mandates/${raiz}/beneficiaries`, { alias: 'Tía', maxDebit: A.cop(1), offlineCap: A.cop(1), pin: '246810' })).statusCode).toBe(403)
  })
})
