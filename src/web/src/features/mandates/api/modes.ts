import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { currentUserId } from '@/lib/auth';
import { type MutationConfig, type QueryConfig } from '@/lib/react-query';
import { type Amount, type ModesResponse, type SpendMode } from '@/types/api';

export type { ModesResponse };

// Modos de consumo de un beneficiario: GET /mandates/:id/modes (los ve él y su
// titular), POST /mandates/:persona/modes (habilitar los que falten) y
// PATCH /mandates/:persona/modes (el titular reparte el tope entre ellos).
// Lo que solo decide el titular va con su cuenta en x-user-id.

const comoTitular = () => ({ headers: { 'x-user-id': currentUserId() ?? '' } });

export type ModeLimit = {
  mandateId: string;
  maxDebit?: Amount;
  offlineCap?: Amount;
};

export const getModes = (mandateId: string): Promise<ModesResponse> =>
  api.get(`/mandates/${mandateId}/modes`);

export const getModesQueryOptions = (mandateId: string) =>
  queryOptions({
    queryKey: ['mandates', mandateId, 'modes'],
    queryFn: () => getModes(mandateId),
  });

export const useModes = ({
  mandateId,
  queryConfig,
}: {
  mandateId?: string;
  queryConfig?: QueryConfig<typeof getModesQueryOptions>;
}) =>
  useQuery({
    ...getModesQueryOptions(mandateId ?? ''),
    enabled: !!mandateId,
    ...queryConfig,
  });

export const enableModes = ({
  personaId,
}: {
  personaId: string;
}): Promise<ModesResponse & { created: SpendMode[] }> =>
  api.post(`/mandates/${personaId}/modes`, undefined, comoTitular());

export const useEnableModes = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof enableModes> } = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: enableModes,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};

// PATCH /mandates/:persona/modes: el reparto entero de una vez (todo o nada).
export const setModeLimits = ({
  personaId,
  limits,
  budget,
}: {
  personaId: string;
  limits: ModeLimit[];
  // Nuevo tope de la persona (sube con lo libre del titular)
  budget?: Amount;
}): Promise<ModesResponse> =>
  api.patch(`/mandates/${personaId}/modes`, { limits, budget }, comoTitular());

export const useSetModeLimits = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof setModeLimits> } = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: setModeLimits,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
