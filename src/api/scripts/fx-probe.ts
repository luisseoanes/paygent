/**
 * Cotiza SIN pagar cuánto le cuesta a Juan que un comercio reciba N pesos, con el cambio real del Test Wallet.
 * Crea el incoming payment del comercio, pide la quote desde la wallet de Juan y cierra el incoming: no se mueve dinero.
 *
 *   pnpm --filter @openroute/api fx:probe 12000            (con las variables de Railway: railway run pnpm …)
 */
import { DEMO_WALLETS } from '../src/demo/wallets.ts'
import { env } from '../src/env.ts'
import { getClient, getWallet } from '../src/op/client.ts'

const pesos = Number(process.argv[2] ?? 12_000)
const merchant = process.argv[3] ?? DEMO_WALLETS.farmacia

const client = await getClient()
const [sender, receiver] = await Promise.all([getWallet(DEMO_WALLETS.juan), getWallet(merchant)])
const token = async (authServer: string, type: 'incoming-payment' | 'quote') => {
  const g = await client.grant.request(
    { url: authServer },
    { access_token: { access: [type === 'quote' ? { type, actions: ['create', 'read'] } : { type, actions: ['create', 'read', 'complete'] }] } },
  )
  if (!('access_token' in g) || !g.access_token) throw new Error(`sin token ${type}`)
  return g.access_token.value
}

const incomingToken = await token(receiver.authServer, 'incoming-payment')
const incomingAmount = { value: String(pesos * 10 ** receiver.assetScale), assetCode: receiver.assetCode, assetScale: receiver.assetScale }
const incoming = await client.incomingPayment.create(
  { url: receiver.resourceServer, accessToken: incomingToken },
  { walletAddress: receiver.id, incomingAmount, metadata: { description: 'fx-probe (sin pago)' } },
)
try {
  const quote = await client.quote.create(
    { url: sender.resourceServer, accessToken: await token(sender.authServer, 'quote') },
    { walletAddress: sender.id, receiver: incoming.id, method: 'ilp' },
  )
  const debit = Number(quote.debitAmount.value) / 10 ** quote.debitAmount.assetScale
  const receive = Number(quote.receiveAmount.value) / 10 ** quote.receiveAmount.assetScale
  console.log(`${receiver.id} recibe ${receive} ${quote.receiveAmount.assetCode}`)
  console.log(`${sender.id} paga   ${debit} ${quote.debitAmount.assetCode}`)
  console.log(`Tasa efectiva: ${(receive / debit).toFixed(2)} ${quote.receiveAmount.assetCode} por ${quote.debitAmount.assetCode} (referencia: FX_COP_PER_USD=${env.FX_COP_PER_USD})`)
} finally {
  await client.incomingPayment.complete({ url: incoming.id, accessToken: incomingToken }).catch(() => {})
}
