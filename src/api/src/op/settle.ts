import { OpenPaymentsClientError } from '@interledger/open-payments'
import { randomId, type Amount } from '@openroute/shared'
import { getActiveGrant } from '../store/grants.ts'
import { env } from '../env.ts'
import { getClient, getWallet } from './client.ts'
import { rotateRootToken } from './grants.ts'

export interface SettleInput {
  merchantWallet: string
  /** Monto a debitar de la wallet del titular (en su moneda). Con `price`, es solo el estimado. */
  amount: Amount
  /**
   * Precio que cobra el comercio en SU moneda. Si coincide con la moneda de su wallet, el comercio recibe
   * exactamente eso y Open Payments cotiza cuánto le cuesta a Juan con el cambio real.
   */
  price?: Amount
  /** Raíz del árbol que paga: su grant es el que mueve el dinero (un titular por raíz). */
  rootId: string
  /** Se llama con el débito real cotizado ANTES de mover el dinero; si lanza, no se paga. */
  confirmDebit?: (debit: Amount) => void | Promise<void>
  /** OP-06: si settle respondió sin confirmar la llegada (`confirmed: false`), se llama cuando se sabe. */
  onLateOutcome?: (outcome: PaymentOutcome) => void | Promise<void>
  metadata?: Record<string, string>
}

/** 12.000 COP con escala 0 → misma cifra en la escala de la wallet del comercio (el Test Wallet usa 2). */
const rescale = (a: Amount, assetScale: number): Amount => {
  const diff = assetScale - a.assetScale
  const value = diff >= 0 ? BigInt(a.value) * 10n ** BigInt(diff) : BigInt(a.value) / 10n ** BigInt(-diff)
  return { value: value.toString(), assetCode: a.assetCode, assetScale }
}

export interface SettleResult {
  outgoingPaymentId: string
  debitAmount: Amount
  receiveAmount: Amount
  /** true: el comercio ya recibió el dinero. false: sigue en camino y el resultado llega por `onLateOutcome`. */
  confirmed: boolean
}

export class SettleError extends Error {}

// ─── OP-05: caché de tokens no interactivos (incoming-payment y quote) por servidor de autorización ───
const tokenCache = new Map<string, { value: string; expiresAt: number }>()

const nonInteractiveToken = async (authServer: string, type: 'incoming-payment' | 'quote') => {
  const key = `${type}@${authServer}`
  const hit = tokenCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const client = await getClient()
  const grant = await client.grant.request(
    { url: authServer },
    {
      access_token: {
        access: [
          type === 'incoming-payment'
            ? { type, actions: ['create', 'read', 'list', 'complete'] }
            : { type, actions: ['create', 'read'] },
        ],
      },
    },
  )
  if (!('access_token' in grant) || !grant.access_token) throw new SettleError(`No se obtuvo token ${type}`)
  const ttl = (grant.access_token.expires_in ?? 600) * 1000
  tokenCache.set(key, { value: grant.access_token.value, expiresAt: Date.now() + ttl - 30_000 })
  return grant.access_token.value
}

/** Precalienta los grants de los comercios para que el primer pago de la demo sea rápido. */
export const prewarm = async (merchantWallets: string[]) => {
  if (env.MOCK_OP) return
  await Promise.allSettled(
    merchantWallets.map(async (w) => nonInteractiveToken((await getWallet(w)).authServer, 'incoming-payment')),
  )
}

// El token del grant raíz caduca a los pocos minutos (expires_in). Vencido, el Test Wallet responde
// 403 "Inactive Token", no 401; en ambos casos se rota con access_token.manage y se reintenta.
export const isExpiredToken = (err: unknown) =>
  err instanceof OpenPaymentsClientError &&
  (err.status === 401 || (err.status === 403 && /inactive token/i.test(err.description ?? '')))

// ─── OP-08: errores de Open Payments → razones legibles ───
export const explainOpError = (err: unknown): string => {
  if (err instanceof OpenPaymentsClientError) {
    const text = `${err.message} ${err.description ?? ''}`.toLowerCase()
    if (err.status === 401) return 'Token inválido o vencido'
    if (text.includes('insufficient')) return 'Saldo insuficiente en la wallet del titular'
    if (text.includes('limit') || text.includes('exceed')) return 'Excede el límite del grant del titular'
    if (text.includes('expired')) return 'La cotización venció'
    return `Open Payments: ${err.description || err.message} (${err.status ?? '?'})`
  }
  return err instanceof Error ? err.message : String(err)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const SETTLE_WAIT_MS = 15_000
const FINISH_TIMEOUT_MS = 120_000

export type PaymentOutcome = 'completed' | 'failed' | 'timeout'

/**
 * Sondea hasta que el comercio recibió al menos `expected` (completed), el outgoing falló (failed) o se
 * acaba el tiempo (timeout). Un error al consultar no corta la espera: se reintenta en la siguiente vuelta.
 */
export const waitForPayment = async (
  check: () => Promise<{ failed: boolean; received: bigint }>,
  expected: bigint,
  { timeoutMs, intervalMs = 500 }: { timeoutMs: number; intervalMs?: number },
): Promise<PaymentOutcome> => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const state = await check().catch(() => null)
    if (state?.failed) return 'failed'
    if (state && state.received >= expected) return 'completed'
    if (Date.now() >= deadline) return 'timeout'
    await sleep(intervalMs)
  }
}

/**
 * OP-04: incoming payment en el comercio → quote desde la wallet de Juan → outgoing con el token raíz.
 * El dinero va directo de Juan al destinatario final. Nadie lo retiene.
 */
export const settle = async (input: SettleInput, retried = false): Promise<SettleResult> => {
  if (env.MOCK_OP) {
    await new Promise((r) => setTimeout(r, 250))
    await input.confirmDebit?.(input.amount) // en mock el débito real es el estimado
    return { outgoingPaymentId: randomId('mock_op_'), debitAmount: input.amount, receiveAmount: input.price ?? input.amount, confirmed: true }
  }
  const { rootId } = input
  const root = await getActiveGrant(rootId)
  if (!root) throw new SettleError('El titular todavía no aprobó el mandato raíz en su billetera')

  const client = await getClient()
  try {
    const [sender, receiver] = await Promise.all([getWallet(root.walletAddress), getWallet(input.merchantWallet)])

    // Compra con precio en la moneda del comercio: se fija lo que RECIBE (12.000 COP) y Open Payments cotiza
    // el débito real en la moneda de Juan. Sin precio (o en otra moneda), se fija lo que se debita.
    const price = input.price?.assetCode === receiver.assetCode ? rescale(input.price, receiver.assetScale) : undefined
    const incomingToken = await nonInteractiveToken(receiver.authServer, 'incoming-payment')
    const incoming = await client.incomingPayment.create(
      { url: receiver.resourceServer, accessToken: incomingToken },
      { walletAddress: receiver.id, metadata: input.metadata, ...(price ? { incomingAmount: price } : {}) },
    )

    const quote = await client.quote.create(
      { url: sender.resourceServer, accessToken: await nonInteractiveToken(sender.authServer, 'quote') },
      price
        ? { walletAddress: sender.id, receiver: incoming.id, method: 'ilp' }
        : { walletAddress: sender.id, receiver: incoming.id, method: 'ilp', debitAmount: input.amount },
    )

    try {
      await input.confirmDebit?.(quote.debitAmount)
    } catch (err) {
      // No se paga: el cobro no debe quedar abierto en el comercio.
      await client.incomingPayment.complete({ url: incoming.id, accessToken: incomingToken }).catch(() => {})
      throw err
    }

    const outgoing = await client.outgoingPayment.create(
      { url: sender.resourceServer, accessToken: root.accessToken },
      { walletAddress: sender.id, quoteId: quote.id, metadata: input.metadata },
    )

    // OP-06: crear el outgoing no significa que el dinero llegó. Esperamos al comercio y cerramos su
    // incoming payment: el Test Wallet solo abona el saldo cuando el incoming se completa (o caduca, a los 30 días).
    const check = async () => {
      const [out, inc] = await Promise.all([
        client.outgoingPayment
          .get({ url: outgoing.id, accessToken: (await getActiveGrant(rootId))?.accessToken ?? root.accessToken })
          .catch(() => null),
        client.incomingPayment.get({ url: incoming.id, accessToken: incomingToken }),
      ])
      return { failed: !!out?.failed, received: BigInt(inc.receivedAmount.value) }
    }
    const finished = waitForPayment(check, BigInt(quote.receiveAmount.value), { timeoutMs: FINISH_TIMEOUT_MS }).then(
      async (outcome) => {
        // Siempre se cierra: si falló o no llegó a tiempo, el cobro no debe quedar abierto (y huérfano) en el comercio.
        await client.incomingPayment.complete({ url: incoming.id, accessToken: incomingToken }).catch((e) => {
          console.warn('[settle] no se pudo cerrar el incoming payment', incoming.id, explainOpError(e))
        })
        if (outcome !== 'completed') console.warn('[settle] pago', outgoing.id, outcome)
        return outcome
      },
    )
    // El pago suele completar en 1-4 s. Si tarda más, se responde y el cierre sigue en segundo plano.
    const outcome = await Promise.race([finished, sleep(SETTLE_WAIT_MS).then(() => 'timeout' as const)])
    if (outcome === 'failed') throw new SettleError('El pago no llegó al comercio: revisa el saldo de la wallet del titular')
    const confirmed = outcome === 'completed'
    if (!confirmed)
      void finished
        .then((late) => input.onLateOutcome?.(late))
        .catch((e) => console.warn('[settle] resultado tardío sin registrar', outgoing.id, e))

    return { outgoingPaymentId: outgoing.id, debitAmount: quote.debitAmount, receiveAmount: quote.receiveAmount, confirmed }
  } catch (err) {
    if (err instanceof SettleError) throw err
    if (!retried && isExpiredToken(err)) {
      // OP-07: si el titular revocó el mandato en su billetera, tampoco se puede rotar el token.
      await rotateRootToken(rootId).catch(() => {
        throw new SettleError('El mandato del titular fue revocado o venció en su billetera: tiene que volver a firmarlo')
      })
      return settle(input, true)
    }
    throw new SettleError(explainOpError(err))
  }
}
