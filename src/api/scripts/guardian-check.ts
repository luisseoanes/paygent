/**
 * Recorre cada regla del Guardián contra los servicios corriendo (api + agents), con vales firmados de verdad.
 *   pnpm --filter @openroute/api guardian:check
 * Hace reset, así que NO lo corras en medio de una demo.
 */
import { amount as A, generateKeyPair, randomId, signVoucher, type Amount, type DeviceCert, type Voucher } from '@openroute/shared'
import { env } from '../src/env.ts'

const API = `http://localhost:${env.PORT}`
const call = async <T = any>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`)
  return json as T
}

let failures = 0
const step = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`)
}

const { asset, fxCopPerUsd } = await call<{ asset: A.Asset; fxCopPerUsd: number }>('/demo/status')
const pesos = (cop: number): Amount => A.fromCop(cop, asset, fxCopPerUsd)
const merchants = await call<any[]>('/merchants')
const tienda = merchants.find((m) => m.id === 'tienda').wallet // donde María compra siempre
const nueva = merchants.find((m) => m.id === 'minimercado')?.wallet ?? 'https://ilp.interledger-test.dev/otra-tienda'

/** Un celular nuevo de María con su propio contador y acumulado. */
const newDevice = async () => {
  await call('/demo/reset', {})
  const keys = generateKeyPair()
  const { cert } = await call<{ cert: DeviceCert }>('/mandates/maria-device/device-key', { publicKey: keys.publicKey })
  let counter = 0
  let cumulative = pesos(0)
  return (cop: number, opts: { merchant?: string; minutesAgo?: number; badCumulative?: boolean } = {}): Voucher => {
    counter++
    const amount = pesos(cop)
    cumulative = A.add(cumulative, amount)
    return signVoucher(
      {
        voucherId: randomId('v_'),
        deviceKeyId: cert.deviceKeyId,
        deviceCert: cert,
        merchantWallet: opts.merchant ?? tienda,
        category: 'mercado',
        amount,
        counter,
        cumulative: opts.badCumulative ? A.add(cumulative, pesos(1000)) : cumulative,
        createdAt: new Date(Date.now() - (opts.minutesAgo ?? 0) * 60_000).toISOString(),
      },
      keys.secretKey,
    )
  }
}
const settle = async (vouchers: Voucher[]) => (await call<any>('/vouchers/settle', { vouchers })).results
const device = () => call<any>('/mandates/maria-device')
// /feed viene del más nuevo al más viejo
const lastGuardian = async () => (await call<any[]>('/feed')).find((e) => e.kind === 'guardian')?.reason ?? ''

// 1. Vale normal en la tienda de siempre, aunque sea alto (72.000 ≤ tope offline de 80.000)
let vale = await newDevice()
let r = await settle([vale(72_000)])
step('Vale normal (alto) en la tienda de siempre se liquida', r[0].status === 'settled', JSON.stringify(r[0]))

// 2. Replay: el mismo vale dos veces → rechazado y celular congelado
vale = await newDevice()
const v1 = vale(10_000)
await settle([v1])
r = await settle([v1])
step('Replay rechazado', r[0].reason === 'replay')
step('Replay: el Guardián congela el celular', (await device()).frozen === true, await lastGuardian())

// 3. Acumulado inconsistente (el celular "olvidó" sumar un vale)
vale = await newDevice()
await settle([vale(10_000)])
r = await settle([vale(10_000, { badCumulative: true })])
step('Acumulado inconsistente rechazado', r[0].reason === 'Acumulado inconsistente', JSON.stringify(r[0]))

// 4. Velocidad: 4 vales en pocos minutos → se liquidan pero quedan marcados
vale = await newDevice()
r = await settle([vale(5000, { minutesAgo: 4 }), vale(5000, { minutesAgo: 3 }), vale(5000, { minutesAgo: 2 }), vale(5000, { minutesAgo: 1 })])
step('Velocidad: 4 vales en 10 min quedan marcados', r.some((x: any) => x.status === 'flagged'), r.map((x: any) => x.status).join(','))

// 5. Comercio nuevo y monto alto → marcado
vale = await newDevice()
r = await settle([vale(72_000, { merchant: nueva })])
step('Comercio nuevo con monto alto queda marcado', r[0].status === 'flagged', await lastGuardian())

// 6. Dos alertas a la vez (velocidad + comercio nuevo alto) → congela
vale = await newDevice()
r = await settle([vale(5000, { minutesAgo: 3 }), vale(5000, { minutesAgo: 2 }), vale(5000, { minutesAgo: 1 }), vale(60_500, { merchant: nueva })])
step('Dos alertas a la vez: el Guardián congela el celular', (await device()).frozen === true, await lastGuardian())

// 7. Tope offline: sube con historial limpio, nunca por encima del techo de Juan; baja con alertas
await call('/demo/reset', {})
const before = (await device()).offlineCap
await call('/guardian/review', {})
const raised = (await device()).offlineCap
step('Historial limpio: el Guardián sube el tope offline', A.cmp(raised, before) > 0, `${A.toNumber(before)} → ${A.toNumber(raised)} ${asset.assetCode}`)
for (let i = 0; i < 5; i++) await call('/guardian/review', {})
const ceiling = (await device()).offlineCapCeiling
step('Nunca supera el techo que autorizó Juan', A.cmp((await device()).offlineCap, ceiling) <= 0, `techo ${A.toNumber(ceiling)}`)
vale = await newDevice()
const again = vale(10_000)
await settle([again])
await settle([again]) // replay → alerta y congelado
await call(`/mandates/maria-device/unfreeze`, {})
const capBefore = (await device()).offlineCap
await call('/guardian/review', {})
step('Con alertas, el Guardián baja el tope offline', A.cmp((await device()).offlineCap, capBefore) < 0, await lastGuardian())

await call('/demo/reset', {})
console.log(failures ? `\n${failures} paso(s) fallaron` : '\nGuardián OK')
process.exit(failures ? 1 : 0)
