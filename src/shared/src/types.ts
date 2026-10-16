// Contratos congelados en H1 (backlog §2.1). Si cambias algo aquí, avisa en el standup.

export type Amount = { value: string; assetCode: string; assetScale: number }

export type HolderType = 'person' | 'device' | 'agent'
export type Category = 'mercado' | 'farmacia' | 'efectivo' | 'datos'
export const CATEGORIES: Category[] = ['mercado', 'farmacia', 'efectivo', 'datos']

/** Forma de pagar de un beneficiario: vale QR del celular (con o sin señal), Asistente en el chat de la app o SMS. */
export type SpendMode = 'celular' | 'asistente' | 'sms'

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
  /** Solo en las ramas de modo de un beneficiario */
  mode?: SpendMode
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
  | 'no_address'

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
  delivery?: DeliveryRequest
  /**
   * Lo que cobra el comercio, en su moneda (p. ej. 12.000 COP). Si viene, el comercio recibe exactamente eso
   * y a Juan se le debita lo que cueste con el cambio real del momento (no con la tasa de referencia).
   * `amount` queda como estimado en la moneda de Juan para autorizar.
   */
  price?: Amount
}

/** Dirección de entrega que registra quien aprueba el mandato raíz (Juan, el Gobierno…). */
export interface DeliveryAddress {
  recipientName: string
  address: string
}

/** Lo que pide el agente. La dirección NO viene del agente: el gateway usa la que registró Juan. */
export interface DeliveryRequest {
  mode: 'pickup' | 'delivery'
  code: string
  fee?: Amount
}

/** Lo que queda guardado en el pago y en el feed (el tendero lo ve). */
export interface Delivery extends DeliveryRequest {
  recipientName?: string
  address?: string
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
  delivery?: Delivery
  payout?: Payout
}

/**
 * Cómo cobra el comercio. Con wallet de Open Payments, directo. Sin wallet, por Puntored:
 * el pago va a la wallet de Puntored y Puntored le acredita al tendero en su llave Bre-B.
 */
export type Payout = { via: 'wallet'; wallet: string } | { via: 'puntored'; llave: string }

export interface Merchant {
  id: string
  name: string
  /** Dirección de cobro: la que va en vales y en /pay. Nunca cambia (los vales la llevan firmada). */
  wallet: string
  category: Category
  isAgent?: boolean
  /** A dónde llega el dinero. Sin payout: directo a `wallet`. */
  payout?: Payout
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
  delivery?: Delivery
  payout?: Payout
  /** Lo que cobró el comercio, en su moneda (si la compra lo fijó) */
  price?: Amount
  /** Lo que de verdad recibió el comercio según Open Payments */
  receiveAmount?: Amount
}

export type VoucherSettleStatus = 'settled' | 'rejected' | 'flagged'
export interface VoucherSettleResult {
  voucherId: string
  status: VoucherSettleStatus
  reason?: string
  paymentId?: string
}
