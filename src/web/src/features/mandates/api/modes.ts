import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig, type QueryConfig } from '@/lib/react-query';
import {
  type Amount,
  type Mandate,
  type ModeView,
  type SpendMode,
} from '@/types/api';

// Modos de consumo de un beneficiario: GET /mandates/:id/modes (los ve él y su
// titular), POST /mandates/:persona/modes (habilitar los que falten) y
// PATCH /mandates/:id/limits (el titular sube o baja el tope de un modo).

export type ModesResponse = { personaId: string; modes: ModeView[] };

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
  api.post(`/mandates/${personaId}/modes`);

export const setLimits = ({
  mandateId,
  data,
}: {
  mandateId: string;
  data: { maxDebit?: Amount; offlineCap?: Amount };
}): Promise<Mandate> => api.patch(`/mandates/${mandateId}/limits`, data);

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

export const useSetLimits = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof setLimits> } = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: setLimits,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
