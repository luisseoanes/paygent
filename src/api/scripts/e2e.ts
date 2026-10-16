/**
 * Guion de la demo de punta a punta contra los servicios corriendo (pnpm dev).
 *   pnpm e2e
 * Hace reset, así que NO lo corras en medio de una demo.
 */
import { amount as A, generateKeyPair, randomId, signVoucher, type DeviceCert, type Voucher } from '@openroute/shared'
import { env } from '../src/env.ts'

const API = `http://localhost:${env.PORT}`
const PHONE = '+573001112233'

const call = async <T = any>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    method,
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
const sms = async (text: string) => (await call<{ reply: string }>('/sms/inbound', { From: PHONE, Body: text })).reply

await call('/demo/reset', {})
await fetch(`${env.AGENTS_URL}/assistant/reset`, { method: 'POST' }).catch(() => {})

// 2–4. La mamá pide por SMS → micropago al Inventario → PIN → pago real
let reply = await sms('necesito la pastilla de la presión')
step('Asistente propone compra y pide PIN', /PIN/.test(reply), reply)
reply = await sms('0000')
step('PIN incorrecto se rechaza', /incorrecto/i.test(reply), reply)
reply = await sms('1234')
step('PIN correcto paga y da código de retiro', /código/.test(reply), reply)
const feed = await call<any[]>('/feed')
step('Micropago agente → agente visible en el feed', feed.some((e) => e.kind === 'agent_to_agent'))
step('Pago a la farmacia visible en el feed', feed.some((e) => e.kind === 'payment' && /Farmacia/.test(e.merchant)))

// 5. María en modo avión: vale firmado → liquidación
const device = generateKeyPair()
const { cert } = await call<{ cert: DeviceCert }>('/mandates/maria-device/device-key', { publicKey: device.publicKey })
const merchants = await call<any[]>('/merchants')
const tienda = merchants.find((m) => m.id === 'tienda')
const voucher: Voucher = signVoucher(
  {
    voucherId: randomId('v_'),
    deviceKeyId: cert.deviceKeyId,
    deviceCert: cert,
    merchantWallet: tienda.wallet,
    category: 'mercado',
    amount: A.usd(5),
    counter: 1,
    cumulative: A.usd(5),
    createdAt: new Date().toISOString(),
  },
  device.secretKey,
)
let settle = await call<any>('/vouchers/settle', { vouchers: [voucher] })
step('Vale offline liquidado', settle.results[0].status === 'settled', JSON.stringify(settle.results[0]))

// 6. Fraude: reenviar el mismo vale
settle = await call<any>('/vouchers/settle', { vouchers: [voucher] })
step('Replay rechazado', settle.results[0].reason === 'replay')
let device_m = await call<any>('/mandates/maria-device')
step('Guardián congela el dispositivo', device_m.frozen === true)
await call('/mandates/maria-device/unfreeze', {})

// 7. Guardián ajusta el tope offline (siempre ≤ techo de Juan)
await call('/demo/reset', {}) // historial limpio para mostrar la subida
const review = await call<any>('/guardian/review', {})
device_m = await call<any>('/mandates/maria-device')
step('Guardián sube el tope offline de María', A.toNumber(device_m.offlineCap) > 20, JSON.stringify(review.changes))

// 8. Juan revoca la rama del Asistente
await call('/mandates/asistente/revoke', {})
reply = await sms('necesito la pastilla de la presión')
step('Tras revocar, el Asistente ya no puede comprar', !/PIN|código/.test(reply), reply)
const maria = await call<any>('/mandates/maria')
step('El resto del árbol sigue funcionando', !maria.revoked)

await call('/demo/reset', {})
console.log(failures ? `\n${failures} paso(s) fallaron` : '\nGuion completo OK')
process.exit(failures ? 1 : 0)
