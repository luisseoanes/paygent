import { describe, expect, it } from 'vitest'
import { waitForPayment } from '../src/op/settle.ts'

// OP-06: settle no puede decir "pagado" hasta que el comercio recibió el dinero.
const sequence = (...states: ({ failed: boolean; received: bigint } | Error)[]) => {
  let i = 0
  return async () => {
    const s = states[Math.min(i++, states.length - 1)]
    if (s instanceof Error) throw s
    return s
  }
}

describe('waitForPayment', () => {
  it('termina en completed cuando lo recibido alcanza lo cotizado', async () => {
    const check = sequence({ failed: false, received: 0n }, { failed: false, received: 954283n })
    expect(await waitForPayment(check, 954283n, { timeoutMs: 1000, intervalMs: 1 })).toBe('completed')
  })

  it('termina en failed si el outgoing falla (p. ej. Juan sin saldo)', async () => {
    const check = sequence({ failed: false, received: 0n }, { failed: true, received: 0n })
    expect(await waitForPayment(check, 100n, { timeoutMs: 1000, intervalMs: 1 })).toBe('failed')
  })

  it('termina en timeout si no llega a tiempo', async () => {
    const check = sequence({ failed: false, received: 10n })
    expect(await waitForPayment(check, 100n, { timeoutMs: 20, intervalMs: 1 })).toBe('timeout')
  })

  it('un error al consultar no corta la espera', async () => {
    const check = sequence(new Error('red'), { failed: false, received: 100n })
    expect(await waitForPayment(check, 100n, { timeoutMs: 1000, intervalMs: 1 })).toBe('completed')
  })
})
