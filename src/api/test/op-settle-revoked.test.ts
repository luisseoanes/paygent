import { OpenPaymentsClientError } from '@interledger/open-payments'
import { describe, expect, it, vi } from 'vitest'
import { amount as A } from '@openroute/shared'

// OP-07: con el grant raíz revocado en el servidor de autorización, el token da 403 y la rotación también falla.
const inactive = () => new OpenPaymentsClientError('Error making Open Payments POST request', { status: 403, description: 'Inactive Token' })
const wallet = (id: string) => ({ id, assetCode: 'USD', assetScale: 2, authServer: `${id}/auth`, resourceServer: `${id}/rs` })

vi.mock('../src/env.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/env.ts')>()
  return { env: { ...real.env, MOCK_OP: false } }
})
vi.mock('../src/op/client.ts', () => ({
  getWallet: async (url: string) => wallet(url),
  getClient: async () => ({
    grant: { request: async () => ({ access_token: { value: 't', expires_in: 600 } }) },
    incomingPayment: { create: async () => ({ id: 'inc' }), complete: async () => ({}) },
    quote: { create: async () => ({ id: 'q', debitAmount: A.USD(1), receiveAmount: A.USD(1) }) },
    outgoingPayment: { create: async () => Promise.reject(inactive()) },
  }),
}))
vi.mock('../src/op/grants.ts', () => ({ rotateRootToken: async () => Promise.reject(inactive()) }))

const store = await import('../src/db.ts')
const { settle } = await import('../src/op/settle.ts')

describe('OP-07: pagar con el mandato raíz revocado', () => {
  it('falla con una razón legible, no con el error crudo de Open Payments', async () => {
    store.db.rootGrant = { walletAddress: 'https://w/juan', accessToken: 'viejo', manageUrl: 'm', continueUri: 'c', continueToken: 'ct' }
    await expect(settle({ merchantWallet: 'https://w/tienda', amount: A.USD(1) })).rejects.toThrow(/revocado o venció/)
  })
})
