import type { Amount } from './types.ts'

// Todo monto viaja en unidades mínimas (string) como en Open Payments. Se opera con BigInt.

export const USD = (cents: number | bigint): Amount => ({ value: String(cents), assetCode: 'USD', assetScale: 2 })

/** "12.50" → 1250 centavos */
export const usd = (dollars: number): Amount => USD(Math.round(dollars * 100))

const same = (a: Amount, b: Amount) => {
  if (a.assetCode !== b.assetCode || a.assetScale !== b.assetScale) {
    throw new Error(`Monedas distintas: ${a.assetCode}/${a.assetScale} vs ${b.assetCode}/${b.assetScale}`)
  }
}

export const add = (a: Amount, b: Amount): Amount => (same(a, b), { ...a, value: String(BigInt(a.value) + BigInt(b.value)) })
export const sub = (a: Amount, b: Amount): Amount => (same(a, b), { ...a, value: String(BigInt(a.value) - BigInt(b.value)) })
export const cmp = (a: Amount, b: Amount): number => {
  same(a, b)
  const d = BigInt(a.value) - BigInt(b.value)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}
export const lte = (a: Amount, b: Amount) => cmp(a, b) <= 0
export const zero = (like: Amount): Amount => ({ ...like, value: '0' })
/** `pct` % del monto, redondeado hacia abajo a la unidad mínima. */
export const percent = (a: Amount, pct: number): Amount => ({ ...a, value: String((BigInt(a.value) * BigInt(Math.round(pct * 100))) / 10_000n) })
export const isZero = (a: Amount) => BigInt(a.value) === 0n

export const toNumber = (a: Amount) => Number(a.value) / 10 ** a.assetScale

export const format = (a: Amount) =>
  `${a.assetCode === 'USD' ? '$' : ''}${toNumber(a).toLocaleString('es-CO', {
    minimumFractionDigits: a.assetScale > 0 ? 2 : 0,
    maximumFractionDigits: a.assetScale,
  })}${a.assetCode === 'USD' ? '' : ' ' + a.assetCode}`

// ─── Moneda raíz: la de la wallet de Juan (COP por defecto; USD si Juan paga desde EE. UU.) ───
export type Asset = Pick<Amount, 'assetCode' | 'assetScale'>
export const COP_ASSET: Asset = { assetCode: 'COP', assetScale: 2 } // como el Test Wallet

export const assetOf = (a: Amount): Asset => ({ assetCode: a.assetCode, assetScale: a.assetScale })
/** Unidades mayores (pesos, dólares) → monto en unidades mínimas del activo. */
export const of = (asset: Asset, major: number): Amount => ({
  value: String(Math.round(major * 10 ** asset.assetScale)),
  ...asset,
})
export const cop = (pesos: number): Amount => of(COP_ASSET, pesos)

// ─── Capa de presentación FX (OP-10): tasa de referencia SIMULADA, solo para COP ↔ USD ───
export const DEFAULT_FX_COP_PER_USD = 4000

const copPerUnit = (assetCode: string, rate: number) => {
  if (assetCode === 'COP') return 1
  if (assetCode === 'USD') return rate
  throw new Error(`Sin tasa de referencia para ${assetCode}: Juan debe pagar en COP o USD`)
}

/** Pesos → monto en la moneda raíz. En COP no hay conversión. */
export const fromCop = (pesos: number, asset: Asset, rate = DEFAULT_FX_COP_PER_USD): Amount =>
  of(asset, pesos / copPerUnit(asset.assetCode, rate))
/** Cualquier monto raíz → pesos, para mostrarlo. */
export const toCop = (a: Amount, rate = DEFAULT_FX_COP_PER_USD) => Math.round(toNumber(a) * copPerUnit(a.assetCode, rate))
export const formatCop = (cop: number) => `$${cop.toLocaleString('es-CO')} COP`
