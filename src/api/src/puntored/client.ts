import { randomBytes } from 'node:crypto'

// Puntored no recibe pagos de Open Payments (nos lo confirmaron): su lado es este adaptador. Hoy simulado; el real
// sería su API de pagos a llaves Bre-B y un webhook firmado con el resultado, sin tocar el resto de Paygent.

export interface Acreditacion {
  /** Nuestra referencia (idempotencia del lado de Puntored) */
  ref: string
  llave: string
  pesos: number
  comercio: string
}

export type ResultadoAcreditacion = { estado: 'acreditado'; ref: string } | { estado: 'fallido'; motivo: string }

export interface PuntoredClient {
  acreditar(a: Acreditacion): Promise<ResultadoAcreditacion>
}

/** Una llave terminada en 0000 no existe en Bre-B: así la demo puede mostrar la falla. */
export const LLAVE_INEXISTENTE = /0000$/

export const puntoredSimulado: PuntoredClient = {
  async acreditar({ llave }) {
    if (LLAVE_INEXISTENTE.test(llave))
      return { estado: 'fallido', motivo: 'La llave Bre-B no está registrada: el dinero queda para retirar en su punto Puntored' }
    return { estado: 'acreditado', ref: `BRB-${randomBytes(5).toString('hex').toUpperCase()}` }
  },
}

export const puntoredClient = (_mode: string): PuntoredClient => puntoredSimulado
