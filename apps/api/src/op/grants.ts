import { createHash, randomUUID } from 'node:crypto'
import { isFinalizedGrant, isPendingGrant } from '@interledger/open-payments'
import type { Amount } from '@openroute/shared'
import { db, save } from '../db.ts'
import { env } from '../env.ts'
import { getClient, getWallet } from './client.ts'

/**
 * OP-02: grant interactivo `outgoing-payment` con limits.debitAmount + limits.interval.
 * Devuelve la URL de consentimiento de la billetera de Juan.
 */
export const requestRootGrant = async (input: { walletAddress: string; maxDebit: Amount; interval: string }) => {
  if (env.MOCK_OP) {
    db.pendingGrant = {
      ...input,
      authServer: 'mock',
      continueUri: 'mock',
      continueToken: 'mock',
      clientNonce: 'mock',
      finishNonce: 'mock',
    }
    save()
    return { redirectUrl: `${env.PUBLIC_API_URL}/callback?interact_ref=mock&hash=mock` }
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
        finish: { method: 'redirect', uri: `${env.PUBLIC_API_URL}/callback`, nonce: clientNonce },
      },
    },
  )
  if (!isPendingGrant(grant)) throw new Error('Se esperaba un grant interactivo (pendiente)')

  db.pendingGrant = {
    ...input,
    authServer: wallet.authServer,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
    clientNonce,
    finishNonce: grant.interact.finish,
  }
  save()
  return { redirectUrl: grant.interact.redirect }
}

/** hash = base64(sha256(clientNonce \n finishNonce \n interact_ref \n grantEndpoint)) — GNAP §4.2.3 */
const expectedHash = (clientNonce: string, finishNonce: string, interactRef: string, authServer: string) =>
  createHash('sha256').update(`${clientNonce}\n${finishNonce}\n${interactRef}\n${authServer}`).digest('base64')

/** OP-03: continuación del grant con interact_ref. Guarda el token raíz. */
export const continueRootGrant = async (interactRef: string, hash: string) => {
  const pending = db.pendingGrant
  if (!pending) throw new Error('No hay un grant pendiente')

  if (env.MOCK_OP) {
    db.rootGrant = {
      walletAddress: pending.walletAddress,
      accessToken: 'mock-token',
      manageUrl: 'mock',
      continueUri: 'mock',
      continueToken: 'mock',
    }
    db.pendingGrant = null
    save()
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

  db.rootGrant = {
    walletAddress: pending.walletAddress,
    accessToken: grant.access_token.value,
    manageUrl: grant.access_token.manage,
    continueUri: grant.continue.uri,
    continueToken: grant.continue.access_token.value,
  }
  db.pendingGrant = null
  save()
  return pending
}

/** OP-05: rota el token raíz cuando vence. */
export const rotateRootToken = async () => {
  if (env.MOCK_OP || !db.rootGrant) return
  const client = await getClient()
  const token = await client.token.rotate({ url: db.rootGrant.manageUrl, accessToken: db.rootGrant.accessToken })
  db.rootGrant = { ...db.rootGrant, accessToken: token.access_token.value, manageUrl: token.access_token.manage }
  save()
}

/** OP-07: revoca el grant raíz en el servidor de autorización (apaga TODO el árbol). */
export const revokeRootGrant = async () => {
  if (!db.rootGrant) return
  if (!env.MOCK_OP) {
    const client = await getClient()
    await client.grant.cancel({ url: db.rootGrant.continueUri, accessToken: db.rootGrant.continueToken })
  }
  db.rootGrant = null
  save()
}
