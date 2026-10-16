import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';
import { type Mandate } from '@/types/api';

// POST /mandates/:id/unfreeze — solo Juan descongela. restrict nunca amplía
// permisos, así que reactivar una rama tiene su propio endpoint.
export const unfreezeMandate = ({
  mandateId,
}: {
  mandateId: string;
}): Promise<Mandate> => api.post(`/mandates/${mandateId}/unfreeze`);

type UseUnfreezeMandateOptions = {
  mutationConfig?: MutationConfig<typeof unfreezeMandate>;
};

export const useUnfreezeMandate = ({
  mutationConfig,
}: UseUnfreezeMandateOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: unfreezeMandate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
