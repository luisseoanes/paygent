import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type QueryConfig } from '@/lib/react-query';
import { type FeedEvent, type Mandate, type MandateTree } from '@/types/api';

import { findNode, subtreeIds } from '../utils/mandate';

// Historial completo de una rama (y de lo que cuelga de ella): todos sus
// movimientos de la libreta del árbol que guarda la API (GET /feed?root=…).
// Cada titular tiene su raíz; si no se conoce (el beneficiario), se sube por
// los padres hasta encontrarla.

const raizDe = async (mandateId: string): Promise<string> => {
  let actual: Mandate = await api.get(`/mandates/${mandateId}`);
  // Un árbol tiene pocos niveles (titular → persona → celular/agente).
  for (let i = 0; i < 6 && actual.parentId; i++)
    actual = await api.get(`/mandates/${actual.parentId}`);
  return actual.id;
};

export const getHistorial = async ({
  mandateId,
  rootId,
}: {
  mandateId: string;
  rootId?: string;
}): Promise<FeedEvent[]> => {
  const raiz = rootId ?? (await raizDe(mandateId));
  const [arbol, eventos] = await Promise.all([
    api.get(`/mandates/${raiz}/tree`) as Promise<MandateTree>,
    api.get('/feed', { params: { root: raiz } }) as Promise<FeedEvent[]>,
  ]);
  const rama = findNode(arbol, mandateId);
  const ids = rama ? subtreeIds(rama) : [mandateId];
  return eventos
    .filter((e) => ids.includes(e.mandateId))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
};

export const getHistorialQueryOptions = (mandateId: string, rootId?: string) =>
  queryOptions({
    // Bajo ['mandates'] para que el feed en vivo lo refresque.
    queryKey: ['mandates', 'historial', mandateId, rootId ?? null],
    queryFn: () => getHistorial({ mandateId, rootId }),
  });

type UseHistorialOptions = {
  mandateId: string;
  rootId?: string;
  queryConfig?: QueryConfig<typeof getHistorialQueryOptions>;
};

export const useHistorial = ({
  mandateId,
  rootId,
  queryConfig,
}: UseHistorialOptions) =>
  useQuery({ ...getHistorialQueryOptions(mandateId, rootId), ...queryConfig });
