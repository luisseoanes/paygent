/**
 * Prueba de humo de Open Payments REAL (PRE-03 / hito H2), sin pasar por el gateway.
 *
 *   pnpm op:smoke            → pide el grant interactivo e imprime la URL de consentimiento
 *   pnpm op:smoke <url-callback-completa>   → continúa el grant y hace un pago de $0.01 a la tienda
 *
 * Requiere MOCK_OP=0, OP_KEY_ID y la llave privada en el .env de la raíz.
 */
import { prepareStore } from '../src/app.ts'
import { getActiveGrant, getMerchant, payerOfRoot } from '../src/db.ts'
import { env } from '../src/env.ts'
import { ROOT_ID } from '../src/gateway/mandates.ts'
import { pesos } from '../src/op/asset.ts'
import { continueRootGrant, requestRootGrant } from '../src/op/grants.ts'
import { settle } from '../src/op/settle.ts'

if (env.MOCK_OP) {
  console.error('MOCK_OP=1 en .env. Pon MOCK_OP=0 para probar Open Payments real.')
  process.exit(1)
}

await prepareStore() // base de datos + moneda de la wallet de Juan (tabla payers)
const payer = await payerOfRoot(ROOT_ID)
const tienda = await getMerchant('minimercado')
if (!payer || !tienda) throw new Error('Falta la semilla: no hay payer o comercio minimercado en la base')
const callback = process.argv[2]
if (!callback) {
  const { redirectUrl } = await requestRootGrant({
    walletAddress: payer.walletAddress,
    maxDebit: pesos(20_000),
    interval: `R/${new Date().toISOString()}/PT5M`,
  })
  console.log('\n1) Abre esta URL y aprueba con la cuenta de Juan:\n\n', redirectUrl)
  console.log('\n2) Copia la URL completa a la que te redirige (aunque falle la página) y corre:\n   pnpm op:smoke "<url>"\n')
} else {
  // zsh escapa ? y = al pegar dentro de comillas: se quitan las barras.
  const url = new URL(callback.replaceAll('\\', ''))
  const interactRef = url.searchParams.get('interact_ref')
  const hash = url.searchParams.get('hash')
  if (!interactRef || !hash) {
    console.error(
      '\nEsa no es la URL de vuelta. Tras pulsar "Aprobar", la billetera te lleva a\n' +
        `  ${env.PUBLIC_API_URL}/callback?hash=…&interact_ref=…\n` +
        'Copia esa (la página puede fallar, es normal) y vuelve a correr el script.\n',
    )
    process.exit(1)
  }
  await continueRootGrant(interactRef, hash)
  console.log('Grant raíz OK. Pagando 40 COP (≈ $0.01) a', tienda.wallet)
  const t = Date.now()
  const result = await settle({ merchantWallet: tienda.wallet, amount: pesos(40), metadata: { description: 'smoke' } })
  console.log(result, `${Date.now() - t} ms`)
  console.log('✅ Revisa el pago en el Test Wallet. rootGrant guardado:', !!(await getActiveGrant(ROOT_ID)))
}
process.exit(0)
