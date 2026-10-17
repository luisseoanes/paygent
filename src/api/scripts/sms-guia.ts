/**
 * La guía docs/guias/sms_offline_voucher_demo_guide.md, paso a paso, contra los servicios corriendo (pnpm dev).
 *   pnpm sms:guia                     número de prueba +573009998877
 *   SMS_GUIA_PHONE=+57… pnpm sms:guia  el número real del celular A
 * SMS_GUIA_PIN=… cambia el PIN de prueba. Hace reset al empezar y al terminar: NO lo corras en medio de una demo.
 */
import {
  amount as A,
  encodeVoucherSms,
  generateKeyPair,
  randomId,
  signVoucher,
  type DeviceCert,
  type Voucher,
} from '@openroute/shared'
import { env } from '../src/env.ts'
import { demoClient } from './demo-client.ts'

const API = `http://localhost:${env.PORT}`
const CELULAR_A = process.env.SMS_GUIA_PHONE ?? '+573009998877'
// PIN que se le pone al SMS en esta prueba; nunca el de un número real en producción.
const PIN = process.env.SMS_GUIA_PIN ?? '7391'
const PIN_MALO = PIN === '1357' ? '2468' : '1357'

// Entra como Juan: activar el SMS, leer la libreta y pedir certificados son cosas del titular.
const call = await demoClient(API)

let failures = 0
const step = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`)
}
// Lo que hace el proveedor de SMS al recibir un mensaje del celular A.
const sms = async (text: string) => (await call<{ reply: string }>('/sms/inbound', { From: CELULAR_A, Body: text })).reply

await call('/demo/reset', {})
await fetch(`${env.AGENTS_URL}/assistant/reset`, { method: 'POST' }).catch(() => {})

// ─── Parte 1: Juan activa el SMS de la rama de María para el celular A ───
const estado = await call<{ active: boolean; phone: string }>('/mandates/maria/sms', { phone: CELULAR_A, pin: PIN }, 'PUT')
step('1–5. Juan activa el SMS; la rama muestra el número enmascarado', estado.active && /•/.test(estado.phone) && estado.phone.endsWith(CELULAR_A.slice(-4)), JSON.stringify(estado))

// ─── Parte 2: la mamá le escribe al Asistente desde el celular A ───
let reply = await sms('cuánto me queda?')
step('6. "cuánto me queda?" responde el saldo', /Le quedan \$/.test(reply), reply)

reply = await sms('necesito acetaminofén')
// Si la tienda lleva a domicilio pregunta primero cómo lo quiere; la guía sigue con recoger.
if (/1 para recogerlo/.test(reply)) reply = await sms('1')
step('7. "necesito acetaminofén" ofrece producto y precio y pide el PIN', /\$[\d.]+/.test(reply) && /PIN/.test(reply), reply)

reply = await sms(PIN_MALO)
step('8. PIN incorrecto se rechaza', /incorrecto/i.test(reply), reply)

reply = await sms(PIN)
step('9. PIN correcto confirma la compra', /Listo, pagado/.test(reply) && /código/.test(reply), reply)
const historial = await call<any[]>('/feed')
step(
  '9. El pago aparece en la rama de María con su porqué',
  historial.some((e) => e.kind === 'payment' && e.mandateId === 'maria-sms' && /Acetamin|acetamin/i.test(e.reason ?? '')),
  historial.filter((e) => e.kind === 'payment').map((e) => `${e.mandateId}: ${e.reason}`).join(' | '),
)

// ─── Parte 3: vale sin señal del celular B, cobrado por SMS desde el celular A ───
const celularB = generateKeyPair()
const { cert } = await call<{ cert: DeviceCert }>('/mandates/maria-device/device-key', { publicKey: celularB.publicKey })
const tienda = (await call<any[]>('/merchants')).find((m) => m.id === 'tienda')
const { copPerUsd } = await call<{ copPerUsd: number }>('/fx')
const monto = A.fromCop(2_000, A.assetOf(cert.offlineCap), copPerUsd)
const vale: Voucher = signVoucher(
  {
    voucherId: randomId('v_'),
    deviceKeyId: cert.deviceKeyId,
    deviceCert: cert,
    merchantWallet: tienda.wallet,
    category: 'mercado',
    amount: monto,
    counter: 1,
    cumulative: monto,
    createdAt: new Date().toISOString(),
  },
  celularB.secretKey,
)
const textoVale = encodeVoucherSms(vale)
step('14. "Cobrar por SMS" arma un mensaje VALE que cabe en un SMS', textoVale.startsWith('VALE ') && textoVale.length <= 306, `${textoVale.length} caracteres`)

reply = await sms(textoVale)
step('14. El vale por SMS se liquida', reply === 'Vale liquidado: $2.000 COP a Tienda Doña Rosa', reply)

reply = await sms(textoVale)
step('15. Reenviar el mismo vale se rechaza', reply === 'Vale rechazado: este vale ya se había cobrado', reply)
step('15. El Guardián congela el celular de María', (await call<any>('/mandates/maria-device')).frozen === true)
const eventos = await call<any[]>('/feed')
step(
  '15. El feed de Juan muestra al Guardián congelando el celular',
  eventos.some((e) => e.kind === 'guardian' && e.mandateId === 'maria-device' && /congel/i.test(e.reason ?? '')),
  eventos.filter((e) => e.kind === 'guardian').map((e) => e.reason).join(' | '),
)
step('16. El feed muestra el vale liquidado', eventos.some((e) => e.kind === 'voucher_settled' && e.mandateId === 'maria-device'))

await call('/demo/reset', {})
console.log(failures ? `\n${failures} paso(s) fallaron` : '\nGuía SMS completa OK')
process.exit(failures ? 1 : 0)
