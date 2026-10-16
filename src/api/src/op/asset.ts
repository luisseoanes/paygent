import { amount as A } from '@openroute/shared'
import { env } from '../env.ts'
import { getWallet } from './client.ts'

// Moneda raíz: la de la wallet de Juan. Todo mandato y pago del árbol va en ella.

let rootAsset: A.Asset = A.COP_ASSET

export const getRootAsset = () => rootAsset
export const setRootAsset = (asset: A.Asset) => (rootAsset = { assetCode: asset.assetCode, assetScale: asset.assetScale })

/** En real, la lee del Test Wallet; en mock, COP (el público del hackatón es colombiano). */
export const resolveRootAsset = async () => {
  if (!env.MOCK_OP) setRootAsset(await getWallet(env.WALLET_JUAN))
  return rootAsset
}

/** Pesos → moneda raíz (sin conversión si Juan paga en COP). */
export const pesos = (cop: number) => A.fromCop(cop, rootAsset, env.FX_COP_PER_USD)
