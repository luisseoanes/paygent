/** Celular → E.164. Sin indicativo se asume Colombia (3XX XXX XXXX). */
export const normalizarCelular = (raw: string): string | null => {
  const d = (raw ?? '').replace(/[\s\-().]/g, '')
  if (/^3\d{9}$/.test(d)) return `+57${d}`
  if (/^573\d{9}$/.test(d)) return `+${d}`
  if (/^\+[1-9]\d{7,14}$/.test(d)) return d
  return null
}
