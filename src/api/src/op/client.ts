import { createPrivateKey, type KeyObject } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createAuthenticatedClient, type AuthenticatedClient, type WalletAddress } from '@interledger/open-payments'
import { env } from '../env.ts'

// OP-01: cliente autenticado con las llaves de la wallet de Paygent.

// Railway no tiene private.key: la llave llega en OP_PRIVATE_KEY, como PEM (con saltos reales o "\n") o en base64.
export const parsePrivateKey = (value: string): KeyObject => {
  const pem = value.includes('BEGIN') ? value.replace(/\\n/g, '\n') : Buffer.from(value, 'base64').toString('utf8')
  try {
    return createPrivateKey(pem)
  } catch {
    throw new Error('OP_PRIVATE_KEY no es una llave privada PEM válida (ni en texto ni en base64)')
  }
}

let clientPromise: Promise<AuthenticatedClient> | null = null

export const getClient = () => {
  if (env.MOCK_OP) throw new Error('MOCK_OP=1: no hay cliente real de Open Payments')
  if (!clientPromise) {
    if (!env.OP_KEY_ID || (!env.OP_PRIVATE_KEY && !existsSync(env.OP_PRIVATE_KEY_PATH))) {
      throw new Error(`Faltan OP_KEY_ID y OP_PRIVATE_KEY u OP_PRIVATE_KEY_PATH (${env.OP_PRIVATE_KEY_PATH}). Ver PRE-02 en el README.`)
    }
    clientPromise = createAuthenticatedClient({
      walletAddressUrl: env.OP_CLIENT_WALLET,
      keyId: env.OP_KEY_ID,
      privateKey: env.OP_PRIVATE_KEY ? parsePrivateKey(env.OP_PRIVATE_KEY) : env.OP_PRIVATE_KEY_PATH,
    })
    clientPromise.catch(() => (clientPromise = null))
  }
  return clientPromise
}

const wallets = new Map<string, WalletAddress>()

export const getWallet = async (url: string) => {
  const cached = wallets.get(url)
  if (cached) return cached
  const client = await getClient()
  const wallet = await client.walletAddress.get({ url })
  wallets.set(url, wallet)
  return wallet
}
