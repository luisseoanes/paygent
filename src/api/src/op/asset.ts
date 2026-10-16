import { amount as A } from '@openroute/shared'
import { DEMO_WALLETS } from '../demo/wallets.ts'
import { env } from '../env.ts'
import { getWallet } from './client.ts'

// Moneda raíz: la de la wallet de quien delega (tabla payers). Todo mandato y pago del árbol va en ella.

let rootAsset: A.Asset = A.COP_ASSET

export const getRootAsset = () => rootAsset
export const setRootAsset = (asset: A.Asset) => (rootAsset = { assetCode: asset.assetCode, assetScale: asset.assetScale })

/**
 * En real, la lee del Test Wallet a partir de la wallet de quien delega (o de la de la demo, si la base está vacía);
 * en mock, COP (el público del hackatón es colombiano).
 */
export const resolveRootAsset = async (payerWallet?: string) => {
  if (!env.MOCK_OP) setRootAsset(await getWallet(payerWallet ?? DEMO_WALLETS.juan))
  return rootAsset
}

/** Pesos → moneda raíz (sin conversión si Juan paga en COP). */
export const pesos = (cop: number) => A.fromCop(cop, rootAsset, env.FX_COP_PER_USD)
