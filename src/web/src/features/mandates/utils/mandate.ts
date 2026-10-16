import {
  type Amount,
  type Category,
  type HolderType,
  type MandateTree,
} from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';

// Traduce el contrato del gateway (montos con assetScale, intervalos ISO
// 8601) a lo que Juan lee en pantalla.

export const amountToNumber = (amount?: Amount) =>
  amount ? Number(amount.value) / 10 ** amount.assetScale : 0;

export const toAmount = (value: number, like: Amount): Amount => ({
  ...like,
  value: String(Math.round(value * 10 ** like.assetScale)),
});

// El grant raíz se pide en USD (la wallet de Juan en el Test Wallet).
export const usd = (value: number): Amount =>
  toAmount(value, { value: '0', assetCode: 'USD', assetScale: 2 });

// "12,50" o "12.50" → 12.5. Vacío o basura → NaN (lo rechaza el schema).
export const parseMoney = (raw: string) =>
  raw.trim() === '' ? Number.NaN : Number(raw.trim().replace(',', '.'));

export type MandateStatus = 'active' | 'frozen' | 'revoked';

export const statusOf = (m: Pick<MandateTree, 'revoked' | 'frozen'>) =>
  m.revoked ? 'revoked' : m.frozen ? 'frozen' : ('active' as MandateStatus);

export const statusLabel: Record<MandateStatus, string> = {
  active: 'Activa',
  frozen: 'Congelada',
  revoked: 'Revocada',
};

export const holderTypeLabel: Record<HolderType, string> = {
  person: 'Persona',
  device: 'Llave de dispositivo',
  agent: 'Agente',
};

export const categoryLabels: Record<Category, string> = {
  mercado: 'Mercado',
  farmacia: 'Farmacia',
  efectivo: 'Efectivo',
  datos: 'Datos',
};

const DURACIONES: Record<string, string> = {
  P1M: '/ mes',
  P1W: '/ semana',
  P7D: '/ semana',
  P1D: '/ día',
  P1Y: '/ año',
};

// "R/2026-10-01T00:00:00Z/P1M" → "/ mes"; "PT5M" → "cada 5 min".
export const intervalLabel = (interval: string) => {
  const duration = interval.split('/').pop() ?? '';
  if (DURACIONES[duration]) return DURACIONES[duration];
  const minutes = /^PT(\d+)M$/.exec(duration);
  if (minutes) return `cada ${minutes[1]} min`;
  return '';
};

export const periodos = ['mes', 'semana', 'dia', 'demo'] as const;
export type Periodo = (typeof periodos)[number];

export const periodoLabel: Record<Periodo, string> = {
  mes: 'Cada mes',
  semana: 'Cada semana',
  dia: 'Cada día',
  demo: 'Cada 5 minutos (demo)',
};

// Intervalo ISO 8601 con repetición que va en limits.interval del grant.
// El mes arranca el día 1 (UTC), como monthly() del gateway.
export const buildInterval = (periodo: Periodo, now = new Date()) => {
  if (periodo === 'mes') {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    return `R/${start.toISOString()}/P1M`;
  }
  const duration = { semana: 'P1W', dia: 'P1D', demo: 'PT5M' }[periodo];
  return `R/${now.toISOString()}/${duration}`;
};

// Próxima renovación del tope a partir del intervalo ISO con repetición.
export const nextRenewal = (interval: string, now = new Date()) => {
  const [, start, duration] = interval.split('/');
  if (!start || !duration) return undefined;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return undefined;
  const step = (d: Date) => {
    if (duration === 'P1M') d.setUTCMonth(d.getUTCMonth() + 1);
    else if (duration === 'P1W' || duration === 'P7D')
      d.setUTCDate(d.getUTCDate() + 7);
    else if (duration === 'P1D') d.setUTCDate(d.getUTCDate() + 1);
    else if (duration === 'P1Y') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else return false;
    return true;
  };
  while (date <= now) if (!step(date)) return undefined;
  return date;
};

export type FilaArbol = { node: MandateTree; nivel: number };

// Ramas y hojas en orden de árbol (sin la raíz), con su nivel de sangría.
export const flattenTree = (root: MandateTree): FilaArbol[] => {
  const filas: FilaArbol[] = [];
  const recorrer = (node: MandateTree, nivel: number) =>
    node.children.forEach((child) => {
      filas.push({ node: child, nivel });
      recorrer(child, nivel + 1);
    });
  recorrer(root, 0);
  return filas;
};

export const findNode = (
  root: MandateTree,
  id: string,
): MandateTree | undefined => {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
};

const activa = (n: MandateTree) => !n.revoked;

// Lo que una rama aún puede repartir: su tope menos el de sus hijos activos.
export const disponibleParaDelegar = (node: MandateTree) =>
  Math.max(
    0,
    amountToNumber(node.maxDebit) -
      node.children
        .filter(activa)
        .reduce((sum, c) => sum + amountToNumber(c.maxDebit), 0),
  );

// Ramas desde las que Juan puede delegar: activas, que gastan y no son un
// dispositivo (la llave de un celular no reparte).
export const ramasDelegables = (root: MandateTree) =>
  [root, ...flattenTree(root).map((f) => f.node)].filter(
    (n) => statusOf(n) === 'active' && n.canSpend && n.holderType !== 'device',
  );

export const subtreeIds = (node: MandateTree): string[] => [
  node.id,
  ...node.children.flatMap(subtreeIds),
];

// "$150" o "$3,50": sin decimales si el monto es entero.
export const money = (n: number) =>
  formatCurrency(n, 'USD', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).replace(/\$\s/, '$');

// Lo que le queda a una rama en el periodo.
export const quedanDe = (
  node: Pick<MandateTree, 'maxDebit' | 'spentInPeriod'>,
) =>
  Math.max(
    0,
    amountToNumber(node.maxDebit) - amountToNumber(node.spentInPeriod),
  );

export type TramoDeGasto = {
  id: string;
  name: string;
  holderType: HolderType;
  spent: number;
};

// Quién se llevó el gasto del mandato: cada rama directa de la raíz (su gasto
// ya incluye el de sus hijos) y lo que la raíz pagó por su cuenta.
export const repartoDelGasto = (root: MandateTree): TramoDeGasto[] => {
  const ramas = root.children
    .map((c) => ({
      id: c.id,
      name: c.holderName,
      holderType: c.holderType,
      spent: amountToNumber(c.spentInPeriod),
    }))
    .filter((t) => t.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const directo =
    amountToNumber(root.spentInPeriod) -
    ramas.reduce((sum, t) => sum + t.spent, 0);
  return directo > 0.005
    ? [
        ...ramas,
        {
          id: root.id,
          name: root.holderName,
          holderType: root.holderType,
          spent: directo,
        },
      ]
    : ramas;
};

// Movimientos agrupados por día ("Hoy", "Ayer", "12 de octubre").
export const agruparPorDia = <T extends { at: string }>(
  items: T[],
  now = new Date(),
) => {
  const dia = (d: Date) => d.toDateString();
  const ayer = new Date(now);
  ayer.setDate(now.getDate() - 1);
  const grupos: { label: string; items: T[] }[] = [];
  items.forEach((item) => {
    const date = new Date(item.at);
    const label =
      dia(date) === dia(now)
        ? 'Hoy'
        : dia(date) === dia(ayer)
          ? 'Ayer'
          : formatDate(date, { day: 'numeric', month: 'long' });
    const grupo = grupos.find((g) => g.label === label);
    if (grupo) grupo.items.push(item);
    else grupos.push({ label, items: [item] });
  });
  return grupos;
};
