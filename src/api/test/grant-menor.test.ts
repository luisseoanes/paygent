import { describe, expect, it } from 'vitest'
import { amount as A, type MandateNode } from '@openroute/shared'
import { buildApp } from '../src/app.ts'
import { seed } from '../src/demo/seed.ts'
import { getMandate, treeOf } from '../src/gateway/mandates.ts'

// Si el titular vuelve a firmar su mandato raíz por MENOS de lo que ya repartió, el árbol baja en proporción
// (en cascada) para que la suma de los hijos nunca supere al padre.
const app = await buildApp({ logger: false })
await seed({ keepGrant: false })

const post = (url: string, payload: object) => app.inject({ method: 'POST', url, payload })
const titular = (
  await post('/auth/register/titular', {
    documento: '92000001', nombre: 'Pedro', apellido: 'Gómez', email: 'pedro.grant@correo.co', telefono: '+573009990002',
    password: 'clave-segura', walletAddress: '$ilp.interledger-test.dev/pedro-grant',
  })
).json()
const raiz = titular.rootMandateId as string

/** Firma el grant de la raíz por `pesos` (mock: la billetera aprueba lo pedido y vuelve a /callback). */
const firmar = async (pesos: number) => {
  const { redirectUrl } = (await post('/mandates/root', { rootMandateId: raiz, maxDebit: A.cop(pesos) })).json()
  const url = new URL(redirectUrl)
  return app.inject({ method: 'GET', url: url.pathname + url.search })
}

const sumaCumple = (n: MandateNode): boolean => {
  const vivos = n.children.filter((c) => !c.revoked)
  const suma = vivos.reduce((acc, c) => acc + BigInt(c.maxDebit.value), 0n)
  return suma <= BigInt(n.maxDebit.value) && vivos.every(sumaCumple)
}

describe('Grant nuevo menor que lo repartido', () => {
  it('baja todo el árbol en proporción y lo deja coherente', async () => {
    await firmar(1_000_000)
    const novia = (
      await post(`/mandates/${raiz}/beneficiaries`, { alias: 'Novia', maxDebit: A.cop(400_000), offlineCap: A.cop(100_000), pin: '246810' })
    ).json()
    const mama = (
      await post(`/mandates/${raiz}/beneficiaries`, { alias: 'Mamá', maxDebit: A.cop(200_000), offlineCap: A.cop(50_000), pin: '246810' })
    ).json()
    const antes = await getMandate(`${novia.mandateId}-cel`)

    // 600.000 repartidos; firma por 300.000: todo a la mitad.
    expect((await firmar(300_000)).headers.location).toMatch(/ok=1/)
    expect((await getMandate(raiz)).maxDebit).toEqual(A.cop(300_000))
    expect((await getMandate(novia.mandateId)).maxDebit).toEqual(A.cop(200_000))
    expect((await getMandate(mama.mandateId)).maxDebit).toEqual(A.cop(100_000))
    // En cascada, pero solo lo que no cabe: Novia tenía 320.000 repartidos de 400.000 (el 20 % libre se gasta
    // primero), así que sus modos bajan a 200/320 y no a la mitad. Su techo sin señal nunca supera su tope.
    const cel = await getMandate(`${novia.mandateId}-cel`)
    expect(antes.maxDebit).toEqual(A.cop(160_000))
    expect(cel.maxDebit).toEqual(A.cop(100_000))
    expect(A.lte(cel.offlineCapCeiling!, cel.maxDebit)).toBe(true)
    expect(sumaCumple(await treeOf(raiz))).toBe(true)

    const feed = (await app.inject({ method: 'GET', url: `/feed?root=${raiz}` })).json() as { reason?: string }[]
    expect(feed.some((e) => /bajaron en proporción/.test(e.reason ?? ''))).toBe(true)
  })

  it('un grant mayor no toca las ramas', async () => {
    const antes = (await treeOf(raiz)).children.map((c) => c.maxDebit.value)
    await firmar(2_000_000)
    expect((await treeOf(raiz)).children.map((c) => c.maxDebit.value)).toEqual(antes)
  })
})
