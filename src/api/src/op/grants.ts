import { createHash, randomUUID } from 'node:crypto'
import { isFinalizedGrant, isPendingGrant } from '@interledger/open-payments'
import type { Amount } from '@openroute/shared'
import { randomId } from '@openroute/shared'
import {
  activateGrant,
  getActiveGrant,
  getPendingGrant,
  insertPendingGrant,
  payerOfRoot,
  setGrantStatus,
  updateGrantToken,
} from '../db.ts'
import { env } from '../env.ts'
import { ROOT_ID } from '../gateway/mandates.ts'
import { getClient, getWallet } from './client.ts'

/**
 * OP-02: grant interactivo `outgoing-payment` con limits.debitAmount + limits.interval.
 * Devuelve la URL de consentimiento de la billetera de Juan.
 */
export const requestRootGrant = async ({ rootId = ROOT_ID, ...input }: { rootId?: string; walletAddress: string; maxDebit: Amount; interval: string }) => {
  const payerId = (await payerOfRoot(rootId))?.userId ?? null
  if (env.MOCK_OP) {
    await insertPendingGrant(rootId, payerId, {
      id: randomId('grant_'),
      ...input,
      authServer: 'mock',
      continueUri: 'mock',
      continueToken: 'mock',
      clientNonce: 'mock',
      finishNonce: 'mock',
    })
    return { redirectUrl: `${env.PUBLIC_API_URL}${callbackPath(rootId)}?interact_ref=mock&hash=mock` }
  }

  const client = await getClient()
  const wallet = await getWallet(input.walletAddress)
  const clientNonce = randomUUID()

  const grant = await client.grant.request(
    { url: wallet.authServer },
    {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['read', 'create', 'list'],
            identifier: wallet.id,
            limits: { debitAmount: input.maxDebit, interval: input.interval },
          },
        ],
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: `${env.PUBLIC_API_URL}${callbackPath(rootId)}`, nonce: clientNonce },
      },
    },
  )
  if (!isPendingGrant(grant)) throw new Error('Se esperaba un grant interactivo (pendiente)')

  await insertPendingGrant(rootId, payerId, {
    id: randomId('grant_'),
    ...input,
    authServer: wallet.authServer,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
    clientNonce,
    finishNonce: grant.interact.finish,
  })
  return { redirectUrl: grant.interact.redirect }
}

/** El callback lleva la raíz en la ruta para saber de qué titular es el grant (la de Juan conserva /callback). */
export const callbackPath = (rootId: string) => (rootId === ROOT_ID ? '/callback' : `/callback/${encodeURIComponent(rootId)}`)

/** hash = base64(sha256(clientNonce \n finishNonce \n interact_ref \n grantEndpoint)) — GNAP §4.2.3 */
const expectedHash = (clientNonce: string, finishNonce: string, interactRef: string, authServer: string) =>
  createHash('sha256').update(`${clientNonce}\n${finishNonce}\n${interactRef}\n${authServer}`).digest('base64')

/** OP-03: continuación del grant con interact_ref. Guarda el token raíz. */
export const continueRootGrant = async (interactRef: string, hash: string, rootId = ROOT_ID) => {
  const pending = await getPendingGrant(rootId)
  if (!pending) throw new Error('No hay un grant pendiente')

  if (env.MOCK_OP) {
    await activateGrant(rootId, pending.id, { accessToken: 'mock-token', manageUrl: 'mock', continueUri: 'mock', continueToken: 'mock' })
    return pending
  }

  if (hash !== expectedHash(pending.clientNonce, pending.finishNonce, interactRef, pending.authServer)) {
    throw new Error('hash de interacción inválido')
  }
  const client = await getClient()
  const grant = await client.grant.continue(
    { url: pending.continueUri, accessToken: pending.continueToken },
    { interact_ref: interactRef },
  )
  if (!isFinalizedGrant(grant) || !grant.access_token) throw new Error('El grant no quedó finalizado')

  await activateGrant(rootId, pending.id, {
    accessToken: grant.access_token.value,
    manageUrl: grant.access_token.manage,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
  })
  return pending
}

/** OP-05: rota el token raíz cuando vence. */
export const rotateRootToken = async (rootId = ROOT_ID) => {
  const grant = await getActiveGrant(rootId)
  if (env.MOCK_OP || !grant) return
  const client = await getClient()
  const token = await client.token.rotate({ url: grant.manageUrl, accessToken: grant.accessToken })
  await updateGrantToken(grant.id, token.access_token.value, token.access_token.manage)
}

/** OP-07: revoca el grant raíz en el servidor de autorización (apaga TODO el árbol). */
export const revokeRootGrant = async (rootId = ROOT_ID) => {
  const grant = await getActiveGrant(rootId)
  if (!grant) return
  if (!env.MOCK_OP) {
    const client = await getClient()
    await client.grant.cancel({ url: grant.continueUri, accessToken: grant.continueToken })
  }
  await setGrantStatus(grant.id, 'revoked')
}
