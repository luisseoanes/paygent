import { OpenPaymentsClientError } from '@interledger/open-payments'
import { describe, expect, it, vi } from 'vitest'
import { amount as A } from '@openroute/shared'

// Token raíz vencido al crear el outgoing: settle rota y reintenta con un cobro nuevo. El primero no queda abierto.
const inactive = () => new OpenPaymentsClientError('Error making Open Payments POST request', { status: 403, description: 'Inactive Token' })
const wallet = (id: string) => ({ id, assetCode: 'USD', assetScale: 2, authServer: `${id}/auth`, resourceServer: `${id}/rs` })
const completed: string[] = []
let incomings = 0
let outgoings = 0

vi.mock('../src/env.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/env.ts')>()
  return { env: { ...real.env, MOCK_OP: false } }
})
vi.mock('../src/op/client.ts', () => ({
  getWallet: async (url: string) => wallet(url),
  getClient: async () => ({
    grant: { request: async () => ({ access_token: { value: 't', expires_in: 600 } }) },
    incomingPayment: {
      create: async () => ({ id: `inc${++incomings}` }),
      complete: async ({ url }: { url: string }) => void completed.push(url),
      get: async () => ({ receivedAmount: A.USD(1) }),
    },
    quote: { create: async () => ({ id: 'q', debitAmount: A.USD(1), receiveAmount: A.USD(1) }) },
    outgoingPayment: {
      create: async () => (++outgoings === 1 ? Promise.reject(inactive()) : { id: 'out' }),
      get: async () => ({ failed: false }),
    },
  }),
}))
vi.mock('../src/op/grants.ts', () => ({ rotateRootToken: async () => {} }))

const { initStore, sql } = await import('../src/store/sql.ts')
const { settle } = await import('../src/op/settle.ts')

describe('OP-05: reintento tras rotar el token raíz', () => {
  it('cierra el incoming payment del primer intento', async () => {
    await initStore()
    await sql().query(
      `insert into root_grants (id, root_mandate_id, status, wallet_address, max_debit, interval, continue_uri, continue_token,
         access_token, manage_url)
       values ('g1', 'root', 'active', 'https://w/juan', '{}'::jsonb, 'P1M', 'c', 'ct', 'viejo', 'm')`,
    )
    const r = await settle({ rootId: 'root', merchantWallet: 'https://w/tienda', amount: A.USD(1) })
    expect(r).toMatchObject({ outgoingPaymentId: 'out', confirmed: true })
    expect(completed).toContain('inc1')
  }, 20_000)
})
