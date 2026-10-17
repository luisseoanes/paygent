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

// Forma de pagar de un beneficiario: vale QR del celular (con o sin señal),
// Asistente en el chat de la app o SMS desde su número.
export type SpendMode = 'celular' | 'asistente' | 'sms';

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
  // Solo en las ramas de modo de un beneficiario
  mode?: SpendMode;
  // ed25519 del gateway
  signature: string;
};

// GET /mandates/:id/modes: los modos vivos de la persona dueña de esa rama.
export type ModeView = {
  mode: SpendMode;
  mandateId: string;
  maxDebit: Amount;
  // Lo mínimo que puede tener: lo que ya repartió a sus propias ramas
  minDebit: Amount;
  spent: Amount;
  remaining: Amount;
  offlineCap?: Amount;
  // Techo sin señal que fijó el titular
  offlineCapCeiling?: Amount;
  pinThreshold?: Amount;
  frozen: boolean;
  // Número desde el que escribe por SMS, si ya enlazó su cuenta
  phone?: string;
};

export type ModesResponse = {
  personaId: string;
  personaName: string;
  // Tope de la persona y lo que tienen sus otras ramas (no modos)
  budget: Amount;
  // Hasta dónde puede subir la persona con lo libre de su titular
  budgetMax: Amount;
  reserved: Amount;
  // Lo que la persona aún puede gastar entre todos sus modos
  remaining: Amount;
  modes: ModeView[];
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

// Tipos de cuenta: el titular tiene wallet y delega; el beneficiario paga
// con lo que le delegaron (se crea enlazando un código); el tendero cobra.
export type Rol = 'titular' | 'beneficiario' | 'tendero';

export type User = {
  id: string;
  role: Rol;
  name: string;
  apellido?: string;
  documento?: string;
  telefono?: string;
  email: string;
  // Wallet address de Open Payments del titular
  walletAddress?: string;
  // Mandato raíz firmado por el titular (grant GNAP)
  rootMandateId: string | null;
  // Rama a la que quedó enlazado el beneficiario (el código que le dieron)
  mandateId?: string;
  // Todas sus ramas (la de la persona y la de su celular)
  mandateIds?: string[];
};
