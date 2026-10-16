// Types shared by several features (API entities, pagination...).
// Types used by a single feature live in that feature's api/ or types/ folder.
//
// Las entidades de Paygent siguen los contratos congelados del backlog
// (backlog.md §2.1, packages/shared/src/types.ts). Si el contrato cambia,
// se cambia aquí primero.

export type BaseEntity = {
  id: string;
  createdAt: number;
};

export type Entity<T> = {
  [K in keyof T]: T[K];
} & BaseEntity;

export type Meta = {
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: Meta;
};

// --- Open Payments / Mandate Gateway ---------------------------------------

export type Amount = { value: string; assetCode: string; assetScale: number };

export type HolderType = 'person' | 'device' | 'agent';

export type Category = 'mercado' | 'farmacia' | 'efectivo' | 'datos';

export type Mandate = {
  id: string;
  parentId: string | null;
  holderType: HolderType;
  holderId: string;
  maxDebit: Amount;
  // ISO 8601 con repetición, ej. "R/2026-10-01T00:00:00Z/P1M"
  interval: string;
  spentInPeriod: Amount;
  categories: Category[];
  pinThreshold?: Amount;
  offlineCap?: Amount;
  // Techo que Juan autorizó para el tope sin señal; el Guardián se mueve dentro.
  offlineCapCeiling?: Amount;
  canSpend: boolean;
  expiresAt: string;
  revoked: boolean;
  frozen: boolean;
  // ed25519 del gateway
  signature: string;
};

// Respuesta de GET /mandates/:id/tree: el mandato con sus hijos anidados.
export type MandateTree = Mandate & {
  // Nombre legible del titular ("María", "Agente Asistente")
  holderName: string;
  children: MandateTree[];
};

export type FeedEvent = {
  id: string;
  at: string;
  mandateId: string;
  actor: { type: HolderType; name: string };
  kind:
    | 'payment'
    | 'agent_to_agent'
    | 'voucher_settled'
    | 'guardian'
    | 'revoked'
    | 'denied'
    // Juan aprobó el mandato raíz en su billetera
    | 'grant';
  amount?: Amount;
  merchant?: string;
  // "por qué" legible
  reason?: string;
};

// --- Sesión -----------------------------------------------------------------

export type User = {
  id: string;
  name: string;
  email: string;
  // Wallet address de Open Payments; se muestra solo si se conoce.
  walletAddress?: string;
  // Mandato raíz firmado por el usuario (grant GNAP)
  rootMandateId: string | null;
};
