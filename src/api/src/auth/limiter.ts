// Intentos fallidos de login por (IP, correo): frena la fuerza bruta sin que un tercero pueda bloquear una cuenta
// desde otra IP. En memoria: una sola réplica de la api; un reinicio lo vacía.

const VENTANA_MS = 15 * 60_000
const MAX_FALLOS = 5
const MAX_CLAVES = 10_000

const fallos = new Map<string, { n: number; desde: number }>()

export const loginBloqueado = (clave: string, now = Date.now()) => {
  const f = fallos.get(clave)
  if (f && now - f.desde >= VENTANA_MS) fallos.delete(clave)
  return !!f && now - f.desde < VENTANA_MS && f.n >= MAX_FALLOS
}

export const loginFallido = (clave: string, now = Date.now()) => {
  if (fallos.size >= MAX_CLAVES) fallos.clear() // tope de memoria ante una inundación de correos distintos
  const f = fallos.get(clave)
  fallos.set(clave, f && now - f.desde < VENTANA_MS ? { n: f.n + 1, desde: f.desde } : { n: 1, desde: now })
}

export const loginCorrecto = (clave: string) => void fallos.delete(clave)
