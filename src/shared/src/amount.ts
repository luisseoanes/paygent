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
export const isZero = (a: Amount) => BigInt(a.value) === 0n

export const toNumber = (a: Amount) => Number(a.value) / 10 ** a.assetScale

export const format = (a: Amount) =>
  `${a.assetCode === 'USD' ? '$' : ''}${toNumber(a).toLocaleString('es-CO', {
    minimumFractionDigits: a.assetScale > 0 ? 2 : 0,
    maximumFractionDigits: a.assetScale,
  })}${a.assetCode === 'USD' ? '' : ' ' + a.assetCode}`

// ─── Capa de presentación FX (OP-10): tasa de referencia SIMULADA ───
export const DEFAULT_FX_COP_PER_USD = 4000

export const usdToCop = (a: Amount, rate = DEFAULT_FX_COP_PER_USD) => Math.round(toNumber(a) * rate)
export const copToUsd = (cop: number, rate = DEFAULT_FX_COP_PER_USD): Amount => usd(cop / rate)
export const formatCop = (cop: number) => `$${cop.toLocaleString('es-CO')} COP`
