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

// 1. Juan registra a dónde llegan los domicilios
await call('/delivery-address/root', { recipientName: 'María', address: 'Vereda La Palma, casa 12' }, 'PUT')

// 2–3. La mamá pide el losartán → micropago al Inventario → elige domicilio → producto + envío ($16.000 ≈ $4), sin PIN
let reply = await sms('necesito la pastilla de la presión')
step('El Asistente pregunta si recoger o enviar a casa de María', /1 para recogerlo/.test(reply) && /casa de María/.test(reply), reply)
reply = await sms('2')
step('Losartán con domicilio se paga sin PIN', /lleva/.test(reply) && /código/.test(reply) && !/PIN/.test(reply), reply)

// 4. "Tráigame la insulina" (≈ $21 + envío) supera el umbral → PIN, sin volver a preguntar la entrega
reply = await sms('tráigame la insulina')
step('Insulina con envío: el Asistente pide PIN', /PIN/.test(reply) && /casa de María/.test(reply), reply)
reply = await sms('0000')
step('PIN incorrecto se rechaza', /incorrecto/i.test(reply), reply)
reply = await sms('1234')
step('PIN correcto paga y da el código de entrega', /código/.test(reply), reply)
const feed = await call<any[]>('/feed')
step('Micropago agente → agente visible en el feed', feed.some((e) => e.kind === 'agent_to_agent'))
step('Pago a la farmacia visible en el feed', feed.some((e) => e.kind === 'payment' && /Farmacia/.test(e.merchant)))
const orders = await call<any[]>('/merchants/farmacia/orders')
step(
  'La farmacia ve los 2 pedidos con la dirección de María',
  orders.length === 2 && orders.every((o) => o.delivery?.mode === 'delivery' && /Vereda La Palma/.test(o.delivery.address)),
  orders.map((o) => `${o.reason} · código ${o.delivery?.code}`).join(' | '),
)

// 5. María en modo avión: vale firmado → liquidación
const device = generateKeyPair()
const { cert } = await call<{ cert: DeviceCert }>('/mandates/maria-device/device-key', { publicKey: device.publicKey })
const merchants = await call<any[]>('/merchants')
const tienda = merchants.find((m) => m.id === 'tienda')
// 20.000 COP en la moneda raíz (la del tope del certificado)
const valeMonto = A.fromCop(20_000, A.assetOf(cert.offlineCap), (await call<{ copPerUsd: number }>('/fx')).copPerUsd)
const voucher: Voucher = signVoucher(
  {
    voucherId: randomId('v_'),
    deviceKeyId: cert.deviceKeyId,
    deviceCert: cert,
    merchantWallet: tienda.wallet,
    category: 'mercado',
    amount: valeMonto,
    counter: 1,
    cumulative: valeMonto,
    createdAt: new Date().toISOString(),
  },
  device.secretKey,
)
let settle = await call<any>('/vouchers/settle', { vouchers: [voucher] })
step('Vale offline liquidado', settle.results[0].status === 'settled', JSON.stringify(settle.results[0]))
const voucherPayment = await call<any>(`/payments/${settle.results[0].paymentId}`)
step(
  'Doña Rosa no tiene wallet: el vale se liquida por Puntored a su llave Bre-B',
  voucherPayment.payout?.via === 'puntored',
  JSON.stringify(voucherPayment.payout),
)

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
