// Entidades del dominio Paygent. Las usan todas las features y el simulador
// del Mandate Gateway (src/stores/gateway-store.ts). Cuando exista apps/api,
// estos tipos deben venir de packages/shared.

export type Usd = number;

export type NodeKind =
  'root' | 'person' | 'device-key' | 'sms-pin' | 'agent' | 'guardian';

export type NodeStatus = 'active' | 'paused' | 'frozen' | 'revoked';

export type LimitInterval = 'mes' | 'semana' | 'compra' | 'offline' | 'ninguno';

export type Category = 'mercado' | 'farmacia' | 'efectivo' | 'consulta';

export type MandateNode = {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  name: string;
  // Placa en mono: "RAMA · AGENTE"
  label: string;
  // Quién usa esta rama, en lenguaje llano.
  holder: string;
  limit: Usd;
  // Tope máximo que firmó Juan. Nadie puede subir `limit` por encima.
  signedLimit: Usd;
  interval: LimitInterval;
  spent: Usd;
  categories: Category[];
  status: NodeStatus;
  pinRequired?: boolean;
  // Monto desde el que se pide PIN (sin dato: siempre)
  pinOver?: Usd;
  // Solo llaves de dispositivo: tope offline dinámico (lo ajusta el Guardián)
  offlineLimit?: Usd;
  offlineCeiling?: Usd;
};

export type Actor =
  | 'juan'
  | 'rosa'
  | 'maria'
  | 'tendero'
  | 'asistente'
  | 'inventario'
  | 'guardian'
  | 'gateway';

export type Channel = 'online' | 'voucher' | 'sms';

export type PaymentStatus = 'sending' | 'processing' | 'completed' | 'failed';

export type Payee = {
  id: string;
  name: string;
  walletAddress: string;
};

export type Payment = {
  id: string;
  folio: number;
  createdAt: number;
  completedAt?: number;
  nodeId: string;
  // Ruta del permiso: raíz → rama → hoja
  path: string[];
  payee: Payee;
  amountUsd: Usd;
  amountCop: number;
  channel: Channel;
  status: PaymentStatus;
  by: string;
  forWhom: string;
  authorizedBy: string;
  why?: string;
  failureReason?: string;
  technical: {
    grantId: string;
    outgoingPaymentUrl: string;
    quoteId: string;
    incomingPaymentUrl: string;
    debitAmount: string;
    sentAmount: string;
    receivedAmount: string;
    // El dinero viaja en la red de prueba; COP y la red celular son simulados.
    real: boolean;
  };
};

export type VoucherStatus =
  'issued' | 'accepted' | 'reviewing' | 'settled' | 'rejected';

export type Voucher = {
  id: string;
  // Alternativa de 8 caracteres al QR
  code: string;
  folio: number;
  nodeId: string;
  amountUsd: Usd;
  amountCop: number;
  category: Category;
  issuedAt: number;
  settleBefore: number;
  // Payload firmado (base64url) + firma ed25519 (hex) + llave del dispositivo
  payload: string;
  signature: string;
  devicePublicKey: string;
  // Certificado: el gateway firmó la llave del dispositivo
  deviceCertificate: string;
  status: VoucherStatus;
  merchantId?: string;
  paymentId?: string;
  rejectReason?: string;
};

export type FeedKind =
  | 'sms.in'
  | 'sms.out'
  | 'agent.step'
  | 'payment.completed'
  | 'payment.failed'
  | 'voucher.issued'
  | 'voucher.accepted'
  | 'voucher.settled'
  | 'voucher.rejected'
  | 'guardian.action'
  | 'mandate.updated';

export type FeedEvent = {
  id: string;
  at: number;
  kind: FeedKind;
  actor: Actor;
  text: string;
  amountUsd?: Usd;
  paymentId?: string;
  nodePath?: string[];
  why?: string;
  // Traza del agente: paso indentado bajo otra entrada
  traceOf?: string;
  real: boolean;
};

export type SmsMessage = {
  id: string;
  at: number;
  direction: 'in' | 'out';
  text: string;
};

export type Charge = {
  id: string;
  code: string;
  amountCop: number;
  amountUsd: Usd;
  createdAt: number;
  status: 'open' | 'paid' | 'cancelled';
  paymentId?: string;
};

export type GrantStatus = 'none' | 'pending' | 'authorized' | 'revoked';

export type Grant = {
  status: GrantStatus;
  id?: string;
  authorizedAt?: number;
  walletAddress: string;
  limit: Usd;
  interval: LimitInterval;
  renewsOn: number;
};

export type VerificationResult =
  | {
      ok: true;
      voucher: Voucher;
      message: string;
    }
  | {
      ok: false;
      reason: 'reused' | 'bad-signature' | 'unknown' | 'expired';
      message: string;
      voucher?: Voucher;
    };
