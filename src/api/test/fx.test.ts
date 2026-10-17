import { describe, expect, it } from 'vitest'
import { bogotaDay, createFx, type Fetcher } from '../src/fx/trm.ts'

// TRM del día (Superfinanciera, datos.gov.co): una consulta por día, y si falla la última conocida o la de respaldo.
const fila = (valor: string, desde: string, hasta: string) => ({ valor, unidad: 'COP', vigenciadesde: `${desde}T00:00:00.000`, vigenciahasta: `${hasta}T00:00:00.000` })
const responde = (rows: object[]) => {
  const urls: string[] = []
  const fetcher: Fetcher = async (url) => {
    urls.push(String(url))
    return new Response(JSON.stringify(rows), { status: 200 })
  }
  return { fetcher, urls }
}
const falla: Fetcher = async () => {
  throw new Error('sin red')
}
// 16 oct 2026, 10:00 en Bogotá (15:00 UTC)
const HOY = new Date('2026-10-16T15:00:00Z')

describe('TRM del día', () => {
  it('el día se cuenta en Bogotá: a las 21:00 del 16 ya es 17 en UTC, pero sigue siendo 16', () => {
    expect(bogotaDay(new Date('2026-10-17T02:00:00Z'))).toBe('2026-10-16')
    expect(bogotaDay(new Date('2026-10-17T05:00:00Z'))).toBe('2026-10-17')
  })

  it('pide la vigente hoy (no la de mañana, que ya está publicada) y la usa', async () => {
    const { fetcher, urls } = responde([fila('3170.46', '2026-10-16', '2026-10-16')])
    const fx = createFx({ fetcher, fallback: 4000 })
    expect(await fx.refresh(HOY)).toEqual({ copPerUsd: 3170.46, fecha: '2026-10-16', fuente: 'trm' })
    expect(fx.rate()).toBe(3170.46)
    expect(decodeURIComponent(urls[0]!)).toContain("vigenciadesde <= '2026-10-16T00:00:00.000'")
  })

  it('el fin de semana vale la TRM del viernes al lunes: la fecha es la de hoy', async () => {
    const { fetcher } = responde([fila('3174.67', '2026-10-17', '2026-10-19')])
    const fx = createFx({ fetcher, fallback: 4000 })
    expect((await fx.refresh(new Date('2026-10-18T15:00:00Z'))).fecha).toBe('2026-10-18')
  })

  it('si la última publicada ya venció, se dice desde cuándo es', async () => {
    const { fetcher } = responde([fila('3100', '2026-10-10', '2026-10-12')])
    const fx = createFx({ fetcher, fallback: 4000 })
    expect((await fx.refresh(HOY)).fecha).toBe('2026-10-10')
  })

  it('consulta una sola vez por día', async () => {
    const { fetcher, urls } = responde([fila('3170.46', '2026-10-16', '2026-10-16')])
    const fx = createFx({ fetcher, fallback: 4000 })
    await fx.refresh(HOY)
    await fx.refresh(new Date(HOY.getTime() + 3600_000))
    expect(urls).toHaveLength(1)
  })

  it('sin red arranca con la de respaldo y la marca como tal', async () => {
    const fx = createFx({ fetcher: falla, fallback: 4000 })
    expect(await fx.refresh(HOY)).toEqual({ copPerUsd: 4000, fecha: null, fuente: 'respaldo' })
  })

  it('si la fuente falla otro día, se queda con la última TRM conocida', async () => {
    let caida = false
    const { fetcher: ok } = responde([fila('3170.46', '2026-10-16', '2026-10-16')])
    const fx = createFx({ fetcher: (url, init) => (caida ? falla(url, init) : ok(url, init)), fallback: 4000 })
    await fx.refresh(HOY)
    caida = true
    expect(await fx.refresh(new Date('2026-10-17T15:00:00Z'))).toMatchObject({ copPerUsd: 3170.46, fecha: '2026-10-16', fuente: 'trm' })
  })

  it('una respuesta sin valor no cambia la tasa', async () => {
    const { fetcher } = responde([{ valor: 'abc' }])
    const fx = createFx({ fetcher, fallback: 4000 })
    expect((await fx.refresh(HOY)).copPerUsd).toBe(4000)
  })

  it('tras un fallo no reintenta en cada llamada, sino pasado un rato', async () => {
    let llamadas = 0
    const fx = createFx({ fetcher: async (u, i) => (llamadas++, falla(u, i)), fallback: 4000, retryMs: 600_000 })
    await fx.refresh(HOY)
    await fx.refresh(new Date(HOY.getTime() + 60_000))
    expect(llamadas).toBe(1)
    await fx.refresh(new Date(HOY.getTime() + 700_000))
    expect(llamadas).toBe(2)
  })

  it('apagada (MOCK_FX) no sale a la red', async () => {
    const fx = createFx({ fetcher: falla, fallback: 4000, enabled: false })
    expect(await fx.refresh(HOY)).toEqual({ copPerUsd: 4000, fecha: null, fuente: 'respaldo' })
  })
})
