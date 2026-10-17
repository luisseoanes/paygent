import { type Category, type MandateNode } from '../types/paygent';

// Reglas del Mandate Gateway. Funciones puras: el modelo propone, el gateway
// decide. Estas son las invariantes que la UI hace visibles:
//   1. Ninguna hoja gasta más que su rama, ni una rama más que la raíz.
//   2. El Guardián solo puede restringir, nunca ampliar.
//   3. La plata va de la wallet de Juan al destinatario final.

export type Tree = Record<string, MandateNode>;

const round = (value: number) => Math.round(value * 100) / 100;

export const pathToRoot = (tree: Tree, nodeId: string): string[] => {
  const path: string[] = [];
  let current: MandateNode | undefined = tree[nodeId];
  while (current) {
    path.unshift(current.id);
    current = current.parentId ? tree[current.parentId] : undefined;
  }
  return path;
};

export const childrenOf = (tree: Tree, nodeId: string | null) =>
  Object.values(tree).filter((node) => node.parentId === nodeId);

export const subtreeIds = (tree: Tree, nodeId: string): string[] => [
  nodeId,
  ...childrenOf(tree, nodeId).flatMap((child) => subtreeIds(tree, child.id)),
];

export const remainingOf = (node: MandateNode) =>
  Math.max(0, round(node.limit - node.spent));

// Lo que de verdad puede gastar una hoja: el mínimo de toda su cadena.
export const effectiveRemaining = (tree: Tree, nodeId: string) =>
  pathToRoot(tree, nodeId).reduce(
    (min, id) => Math.min(min, tree[id] ? remainingOf(tree[id]) : 0),
    Number.POSITIVE_INFINITY,
  );

export type SpendCheck = { ok: true } | { ok: false; reason: string };

export const canSpend = (
  tree: Tree,
  nodeId: string,
  amount: number,
  category: Category,
  // Vales ya aceptados se liquidan aunque la llave se haya congelado después.
  { allowFrozen = false }: { allowFrozen?: boolean } = {},
): SpendCheck => {
  const path = pathToRoot(tree, nodeId);
  for (const id of path) {
    const node = tree[id];
    if (!node) return { ok: false, reason: 'Rama desconocida' };
    if (node.status === 'revoked')
      return { ok: false, reason: `${node.name} fue revocada por Juan` };
    if (node.status === 'paused')
      return { ok: false, reason: `${node.name} está en pausa` };
    if (node.status === 'frozen' && !allowFrozen)
      return { ok: false, reason: `${node.name} está congelada` };
    if (node.kind === 'guardian')
      return { ok: false, reason: 'El Guardián no puede gastar' };
    if (remainingOf(node) < amount)
      return { ok: false, reason: `Supera el tope de ${node.name}` };
  }
  const leaf = tree[nodeId];
  if (leaf && !leaf.categories.includes(category))
    return { ok: false, reason: `${leaf.name} no cubre esa categoría` };
  return { ok: true };
};

// Debita el pago en la hoja y en todos sus ancestros: por eso "dos reglas
// suben juntas" (la del Asistente y la raíz de Juan).
export const applyDebit = (
  tree: Tree,
  nodeId: string,
  amount: number,
): Tree => {
  const next = { ...tree };
  for (const id of pathToRoot(tree, nodeId)) {
    const node = next[id];
    if (node) next[id] = { ...node, spent: round(node.spent + amount) };
  }
  return next;
};

// Monotonía: solo se puede bajar un tope. Subirlo exige un mandato nuevo.
export const lowerLimit = (tree: Tree, nodeId: string, newLimit: number) => {
  const node = tree[nodeId];
  if (!node) return tree;
  const clamped = Math.max(node.spent, Math.min(node.limit, round(newLimit)));
  return { ...tree, [nodeId]: { ...node, limit: clamped } };
};
