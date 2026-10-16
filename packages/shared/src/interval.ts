// Ventanas de "interval" ISO 8601 (R/inicio/duración), igual que limits.interval en Open Payments.
// Soporta duraciones tipo P1M, P1W, P1D, PT5M, PT2M, P1Y.

const DUR = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

export const parseInterval = (interval: string) => {
  const [, start, dur] = interval.split('/')
  if (!start || !dur) throw new Error(`interval inválido: ${interval}`)
  const m = DUR.exec(dur)
  if (!m) throw new Error(`duración inválida: ${dur}`)
  const [y, mo, w, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0))
  return { start: new Date(start), years: y, months: mo, ms: ((w * 7 + d) * 24 * 3600 + h * 3600 + mi * 60 + s) * 1000 }
}

const step = (date: Date, p: ReturnType<typeof parseInterval>, k: number) => {
  const r = new Date(date)
  if (p.years || p.months) r.setUTCMonth(r.getUTCMonth() + k * (p.years * 12 + p.months))
  return new Date(r.getTime() + k * p.ms)
}

/** Inicio de la ventana vigente en `now`. */
export const currentPeriodStart = (interval: string, now = new Date()): Date => {
  const p = parseInterval(interval)
  if (now < p.start) return p.start
  // Búsqueda lineal acotada: suficiente para intervalos de minutos durante un hackathon.
  let lo = 0
  let hi = 1
  while (step(p.start, p, hi) <= now) hi *= 2
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (step(p.start, p, mid) <= now) lo = mid
    else hi = mid
  }
  return step(p.start, p, lo)
}

export const monthly = (from = new Date()) =>
  `R/${new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)).toISOString()}/P1M`
export const weekly = (from = new Date()) => `R/${from.toISOString()}/P1W`
