import { describe, expect, it } from 'vitest'
import { COP_ASSET, assetOf, cop, fromCop, of, toCop, usd } from './amount.ts'

const USD_ASSET = { assetCode: 'USD', assetScale: 2 }

describe('montos en la moneda de la wallet de Juan', () => {
  it('of: unidades mayores → mínimas según la escala del activo', () => {
    expect(of(COP_ASSET, 48_000)).toEqual({ value: '4800000', assetCode: 'COP', assetScale: 2 })
    expect(of({ assetCode: 'COP', assetScale: 0 }, 48_000).value).toBe('48000')
  })

  it('cop: pesos en el activo COP del Test Wallet', () => expect(cop(12_000)).toEqual(of(COP_ASSET, 12_000)))

  it('fromCop: si Juan paga en COP no hay conversión', () => expect(fromCop(12_000, COP_ASSET, 4000)).toEqual(cop(12_000)))

  it('fromCop: si Juan paga en USD convierte con la tasa de referencia', () =>
    expect(fromCop(12_000, USD_ASSET, 4000)).toEqual(usd(3)))

  it('toCop: COP queda igual; USD se convierte', () => {
    expect(toCop(cop(12_000), 4000)).toBe(12_000)
    expect(toCop(usd(3), 4000)).toBe(12_000)
  })

  it('una moneda sin tasa de referencia falla en vez de inventar un monto', () =>
    expect(() => fromCop(1000, { assetCode: 'MXN', assetScale: 2 }, 4000)).toThrow(/MXN/))

  it('assetOf: el activo de un monto', () => expect(assetOf(usd(1))).toEqual(USD_ASSET))
})
