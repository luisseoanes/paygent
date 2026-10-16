import { amount as A, type Amount, type AuthDecision, type Category, type Mandate } from '@openroute/shared'
import { chainOf, rollPeriod } from './mandates.ts'

export interface AuthorizeInput {
  mandateId: string
  amount: Amount
  category: Category
  /** true si el PIN ya se verificó (o si el canal no lo requiere, ej. vales offline) */
  pinOk?: boolean
  now?: Date
}

/**
 * GW-04: el motor de reglas. Recorre la cadena hasta la raíz.
 * El modelo propone; ESTE código decide. Nunca depende de un LLM.
 */
export const authorize = async (input: AuthorizeInput): Promise<AuthDecision> => {
  let chain: Mandate[]
  try {
    chain = await chainOf(input.mandateId)
  } catch {
    return { result: 'deny', reason: 'not_found' }
  }
  return authorizeChain(chain, input)
}

/** Las reglas sobre la cadena ya cargada (hoja → raíz). Puro: no toca la base. */
export const authorizeChain = (
  chain: Mandate[],
  { amount, category, pinOk = false, now = new Date() }: AuthorizeInput,
): AuthDecision => {
  const leaf = chain[0]

  if (!leaf.canSpend) return { result: 'deny', reason: 'cannot_spend', detail: `${leaf.holderName} no puede gastar` }
  if (BigInt(amount.value) <= 0n) return { result: 'deny', reason: 'over_limit', detail: 'Monto inválido' }

  for (const m of chain) {
    rollPeriod(m, now)
    if (m.revoked) return { result: 'deny', reason: 'revoked', detail: `Mandato de ${m.holderName} revocado` }
    if (m.frozen) return { result: 'deny', reason: 'frozen', detail: `Mandato de ${m.holderName} congelado` }
    if (new Date(m.expiresAt) < now) return { result: 'deny', reason: 'expired', detail: `Mandato de ${m.holderName} vencido` }
    if (!m.categories.includes(category))
      return { result: 'deny', reason: 'category', detail: `${m.holderName} no tiene permiso para ${category}` }
    if (!A.lte(A.add(m.spentInPeriod, amount), m.maxDebit))
      return {
        result: 'deny',
        reason: 'over_limit',
        detail: `Supera el tope de ${m.holderName} (${A.format(A.sub(m.maxDebit, m.spentInPeriod))} disponibles)`,
      }
  }

  // Humano en el bucle: por encima del umbral se pide PIN. Umbral 0 = siempre.
  if (leaf.pinThreshold && !pinOk) {
    const always = A.isZero(leaf.pinThreshold)
    if (always || A.cmp(amount, leaf.pinThreshold) > 0) return { result: 'needs_pin', pendingId: '' }
  }

  return { result: 'allow' }
}
