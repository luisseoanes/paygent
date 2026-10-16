// Contratos congelados en H1 (backlog §2.1). Si cambias algo aquí, avisa en el standup.

export type Amount = { value: string; assetCode: string; assetScale: number }

export type HolderType = 'person' | 'device' | 'agent'
export type Category = 'mercado' | 'farmacia' | 'efectivo' | 'datos'
export const CATEGORIES: Category[] = ['mercado', 'farmacia', 'efectivo', 'datos']

export interface Mandate {
  id: string
  parentId: string | null
  holderType: HolderType
  holderId: string
  holderName: string
  maxDebit: Amount
  interval: string // ISO 8601, ej. "R/2026-10-01T00:00:00Z/P1M"
  spentInPeriod: Amount
  periodStart: string
  categories: Category[]
  pinThreshold?: Amount
  offlineCap?: Amount
  /** Techo que Juan autorizó para el tope offline. El Guardián se mueve dentro de [0, offlineCapCeiling]. */
  offlineCapCeiling?: Amount
  canSpend: boolean
  expiresAt: string
  revoked: boolean
  frozen: boolean
  signature: string // ed25519 del gateway
}

export interface MandateNode extends Mandate {
  children: MandateNode[]
}

/** Certificado que el gateway emite para la llave de un dispositivo (OFF-02). */
export interface DeviceCert {
  certId: string
  deviceKeyId: string
  mandateId: string
  publicKey: string // base64
  offlineCap: Amount
  issuedAt: string
  expiresAt: string
  signature: string // ed25519 del gateway
}

export interface Voucher {
  voucherId: string
  deviceKeyId: string
  deviceCert: DeviceCert
  merchantWallet: string
  category: Category
  amount: Amount
  counter: number // por certificado, empieza en 1
  cumulative: Amount // suma de los vales emitidos con este certificado
  createdAt: string
  signature: string // ed25519 del dispositivo
}

export type DenyReason =
  | 'over_limit'
  | 'category'
  | 'revoked'
  | 'frozen'
  | 'expired'
  | 'bad_signature'
  | 'replay'
  | 'bad_pin'
  | 'cannot_spend'
  | 'not_found'
  | 'payment_failed'

export type AuthDecision =
  | { result: 'allow' }
  | { result: 'needs_pin'; pendingId: string }
  | { result: 'deny'; reason: DenyReason; detail?: string }

export type PayResponse = AuthDecision & { paymentId?: string }

export interface PayRequest {
  mandateId: string
  merchantWallet: string
  amount: Amount
  category: Category
  reason: string
  pin?: string
  pendingId?: string
}

export type FeedKind = 'payment' | 'agent_to_agent' | 'voucher_settled' | 'guardian' | 'revoked' | 'denied' | 'grant'

export interface FeedEvent {
  id: string
  at: string
  mandateId: string
  actor: { type: HolderType; name: string }
  kind: FeedKind
  amount?: Amount
  merchant?: string
  reason?: string // "por qué" legible
}

export interface Merchant {
  id: string
  name: string
  wallet: string
  category: Category
  isAgent?: boolean
}

export interface Payment {
  id: string
  mandateId: string
  merchantWallet: string
  amount: Amount
  category: Category
  reason: string
  status: 'pending' | 'completed' | 'failed'
  outgoingPaymentId?: string
  createdAt: string
}

export type VoucherSettleStatus = 'settled' | 'rejected' | 'flagged'
export interface VoucherSettleResult {
  voucherId: string
  status: VoucherSettleStatus
  reason?: string
  paymentId?: string
}
