import {
  type Amount,
  type Category,
  type FeedEvent,
  type HolderType,
  type MandateTree,
} from '@/types/api';

// Datos semilla de la demo (backlog GW-01) para los handlers MSW, con los
// mismos ids que la semilla de apps/api ("root" es el mandato raíz).
// resetDb() vuelve al estado inicial.

const usd = (dollars: number): Amount => ({
  value: String(Math.round(dollars * 100)),
  assetCode: 'USD',
  assetScale: 2,
});

const INTERVAL = 'R/2026-10-01T00:00:00Z/P1M';
const EXPIRES = '2027-01-01T00:00:00Z';

type Seed = {
  id: string;
  parentId: string | null;
  holderType: HolderType;
  holderId: string;
  holderName: string;
  max: number;
  spent: number;
  categories: Category[];
  pin?: number;
  offline?: number;
  canSpend?: boolean;
};

const SEEDS: Seed[] = [
  {
    id: 'root',
    parentId: null,
    holderType: 'person',
    holderId: '$ilp.interledger-test.dev/juan',
    holderName: 'Juan',
    max: 300,
    spent: 87.5,
    categories: ['mercado', 'farmacia', 'efectivo', 'datos'],
  },
  {
    id: 'mnd_maria',
    parentId: 'root',
    holderType: 'person',
    holderId: 'María · +57 300 555 0142',
    holderName: 'María',
    max: 150,
    spent: 62,
    categories: ['mercado', 'farmacia'],
  },
  {
    id: 'maria-device',
    parentId: 'mnd_maria',
    holderType: 'device',
    holderId: 'Celular de María · llave ed25519',
    holderName: 'Celular de María',
    max: 40,
    spent: 12,
    categories: ['mercado', 'farmacia'],
    offline: 20,
  },
  {
    id: 'mnd_rosa',
    parentId: 'root',
    holderType: 'person',
    holderId: 'Doña Rosa · SMS +57 311 555 0199',
    holderName: 'Doña Rosa',
    max: 80,
    spent: 25.5,
    categories: ['farmacia', 'mercado'],
    pin: 5,
  },
  {
    id: 'mnd_asistente',
    parentId: 'mnd_rosa',
    holderType: 'agent',
    holderId: 'agent_asistente',
    holderName: 'Agente Asistente',
    max: 60,
    spent: 3.01,
    categories: ['farmacia', 'mercado', 'datos'],
    pin: 0,
  },
  {
    id: 'mnd_guardian',
    parentId: 'root',
    holderType: 'agent',
    holderId: 'agent_guardian',
    holderName: 'Agente Guardián',
    max: 0,
    spent: 0,
    categories: [],
    canSpend: false,
  },
];

const toTree = (seed: Seed): MandateTree => ({
  id: seed.id,
  parentId: seed.parentId,
  holderType: seed.holderType,
  holderId: seed.holderId,
  holderName: seed.holderName,
  maxDebit: usd(seed.max),
  interval: INTERVAL,
  spentInPeriod: usd(seed.spent),
  categories: seed.categories,
  pinThreshold: seed.pin !== undefined ? usd(seed.pin) : undefined,
  offlineCap: seed.offline !== undefined ? usd(seed.offline) : undefined,
  canSpend: seed.canSpend ?? true,
  expiresAt: EXPIRES,
  revoked: false,
  frozen: false,
  signature: `sig_${seed.id}`,
  children: [],
});

const buildTree = () => {
  const nodes = SEEDS.map(toTree);
  nodes.forEach((n) => {
    if (n.parentId) nodes.find((p) => p.id === n.parentId)?.children.push(n);
  });
  return nodes[0]!;
};

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();

const buildFeed = (): FeedEvent[] => [
  {
    id: 'evt_1',
    at: minutesAgo(3),
    mandateId: 'mnd_asistente',
    actor: { type: 'agent', name: 'Agente Asistente' },
    kind: 'payment',
    amount: usd(3),
    merchant: 'Farmacia San José',
    reason:
      'Doña Rosa pidió "la pastilla de la presión" por SMS y confirmó con su PIN.',
  },
  {
    id: 'evt_2',
    at: minutesAgo(4),
    mandateId: 'mnd_asistente',
    actor: { type: 'agent', name: 'Agente Asistente' },
    kind: 'agent_to_agent',
    amount: usd(0.01),
    merchant: 'Agente de Inventario',
    reason: 'Pagó la consulta de inventario para encontrar el losartán.',
  },
  {
    id: 'evt_3',
    at: minutesAgo(40),
    mandateId: 'maria-device',
    actor: { type: 'device', name: 'Celular de María' },
    kind: 'voucher_settled',
    amount: usd(12),
    merchant: 'Tienda Doña Rosa',
    reason: 'Vale firmado sin señal; se liquidó al volver la conexión.',
  },
  {
    id: 'evt_4',
    at: minutesAgo(41),
    mandateId: 'maria-device',
    actor: { type: 'agent', name: 'Agente Guardián' },
    kind: 'guardian',
    reason:
      'Rechazó un vale repetido (mismo contador). El original sí se pagó.',
  },
];

export const db = {
  tree: buildTree(),
  feed: buildFeed(),
  // ¿Juan ya aprobó el grant raíz en su billetera? (GET /demo/status)
  rootGrant: true,
  // Vales ya cobrados (certId:counter) para detectar el doble cobro
  valesCobrados: new Set<string>(),
  // SMS activo por rama: mandato → celular en E.164
  sms: {} as Record<string, string>,
};

export const resetDb = () => {
  db.tree = buildTree();
  db.feed = buildFeed();
  db.rootGrant = true;
  db.valesCobrados = new Set();
  db.sms = {};
};

export const findInTree = (
  node: MandateTree,
  id: string,
): MandateTree | undefined =>
  node.id === id
    ? node
    : node.children.reduce<MandateTree | undefined>(
        (found, child) => found ?? findInTree(child, id),
        undefined,
      );

export const usdAmount = usd;
