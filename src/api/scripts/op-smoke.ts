/**
 * Prueba de humo de Open Payments REAL (PRE-03 / hito H2), sin pasar por el gateway.
 *
 *   pnpm op:smoke            → pide el grant interactivo e imprime la URL de consentimiento
 *   pnpm op:smoke <url-callback-completa>   → continúa el grant y hace un pago de $0.01 a la tienda
 *
 * Requiere MOCK_OP=0, OP_KEY_ID y la llave privada en el .env de la raíz.
 */
import { amount as A } from '@openroute/shared'
import { db } from '../src/db.ts'
import { env } from '../src/env.ts'
import { continueRootGrant, requestRootGrant } from '../src/op/grants.ts'
import { settle } from '../src/op/settle.ts'

if (env.MOCK_OP) {
  console.error('MOCK_OP=1 en .env. Pon MOCK_OP=0 para probar Open Payments real.')
  process.exit(1)
}

const callback = process.argv[2]
if (!callback) {
  const { redirectUrl } = await requestRootGrant({
    walletAddress: env.WALLET_JUAN,
    maxDebit: A.usd(5),
    interval: `R/${new Date().toISOString()}/PT5M`,
  })
  console.log('\n1) Abre esta URL y aprueba con la cuenta de Juan:\n\n', redirectUrl)
  console.log('\n2) Copia la URL completa a la que te redirige (aunque falle la página) y corre:\n   pnpm op:smoke "<url>"\n')
} else {
  const url = new URL(callback)
  await continueRootGrant(url.searchParams.get('interact_ref')!, url.searchParams.get('hash')!)
  console.log('Grant raíz OK. Pagando $0.01 a', env.WALLET_TIENDA)
  const t = Date.now()
  const result = await settle({ merchantWallet: env.WALLET_TIENDA, amount: A.USD(1), metadata: { description: 'smoke' } })
  console.log(result, `${Date.now() - t} ms`)
  console.log('✅ Revisa el pago en el Test Wallet. rootGrant guardado:', !!db.rootGrant)
}
await new Promise((r) => setTimeout(r, 300)) // deja que db.json se escriba
