import { OpenPaymentsClientError } from '@interledger/open-payments'
import { describe, expect, it } from 'vitest'
import { isExpiredToken } from '../src/op/settle.ts'

const opError = (status: number, description: string) =>
  new OpenPaymentsClientError('Error making Open Payments POST request', { status, description })

// Regresión: con el token raíz vencido el Test Wallet responde 403 "Inactive Token" y settle no rotaba.
describe('isExpiredToken', () => {
  it('rota ante 403 Inactive Token (token vencido en el Test Wallet)', () => {
    expect(isExpiredToken(opError(403, 'Inactive Token'))).toBe(true)
  })

  it('rota ante 401', () => {
    expect(isExpiredToken(opError(401, 'Unauthorized'))).toBe(true)
  })

  it('no rota ante otros 403 (p. ej. límite del grant) ni ante errores que no son de Open Payments', () => {
    expect(isExpiredToken(opError(403, 'Insufficient Grant'))).toBe(false)
    expect(isExpiredToken(new Error('Inactive Token'))).toBe(false)
  })
})
