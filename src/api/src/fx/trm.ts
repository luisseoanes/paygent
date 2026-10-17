import { env } from '../env.ts'

// TRM del día (Superintendencia Financiera, datos abiertos). Se consulta una vez por día; si falla, la última conocida
// o FX_COP_PER_USD. Toda la tasa sale de aquí: gateway, web y agentes convierten con la misma.

export interface Fx {
  copPerUsd: number
  /** Día (Bogotá) en que vale; null si es la de respaldo */
  fecha: string | null
  fuente: 'trm' | 'respaldo'
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

type Fila = { valor?: string; vigenciadesde?: string; vigenciahasta?: string }

/** Día civil en Bogotá (UTC−5, sin horario de verano). */
export const bogotaDay = (now: Date) => new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 10)

export const createFx = ({
  fetcher = fetch,
  fallback,
  url = env.FX_TRM_URL,
  enabled = true,
  timeoutMs = 5000,
  retryMs = 10 * 60_000,
}: { fetcher?: Fetcher; fallback: number; url?: string; enabled?: boolean; timeoutMs?: number; retryMs?: number }) => {
  let current: Fx = { copPerUsd: fallback, fecha: null, fuente: 'respaldo' }
  let checkedOn: string | null = null
  let failedAt = -Infinity

  const fetchTrm = async (day: string): Promise<Fx> => {
    // La de mañana ya está publicada: se pide la última vigente hoy.
    const q = `$where=${encodeURIComponent(`vigenciadesde <= '${day}T00:00:00.000'`)}&$order=${encodeURIComponent('vigenciadesde DESC')}&$limit=1`
    const res = await fetcher(`${url}?${q}`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const [row] = (await res.json()) as Fila[]
    const copPerUsd = Number(row?.valor)
    if (!row?.vigenciadesde || !Number.isFinite(copPerUsd) || copPerUsd <= 0) throw new Error('respuesta sin valor')
    const vence = row.vigenciahasta?.slice(0, 10) ?? ''
    return { copPerUsd, fecha: vence >= day ? day : row.vigenciadesde.slice(0, 10), fuente: 'trm' }
  }

  const refresh = async (now = new Date()): Promise<Fx> => {
    const day = bogotaDay(now)
    if (!enabled || checkedOn === day || now.getTime() - failedAt < retryMs) return current
    try {
      current = await fetchTrm(day)
      checkedOn = day
    } catch (e) {
      failedAt = now.getTime()
      console.warn(`[fx] TRM no disponible (${(e as Error).message}): sigo con ${current.copPerUsd} (${current.fuente})`)
    }
    return current
  }

  return { refresh, current: () => current, rate: () => current.copPerUsd }
}

const fx = createFx({ fallback: env.FX_COP_PER_USD, enabled: !env.MOCK_FX })

/** Tasa COP por USD vigente (síncrona: la última que se trajo). */
export const fxRate = fx.rate
export const currentFx = fx.current
export const refreshFx = fx.refresh
