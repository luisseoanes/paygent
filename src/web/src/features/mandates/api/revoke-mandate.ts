import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';

// POST /mandates/:id/revoke — revoca la rama y todo lo que cuelga de ella.
export const revokeMandate = ({
  mandateId,
}: {
  mandateId: string;
}): Promise<{ revoked: string[] }> => api.post(`/mandates/${mandateId}/revoke`);

type UseRevokeMandateOptions = {
  mutationConfig?: MutationConfig<typeof revokeMandate>;
};

export const useRevokeMandate = ({
  mutationConfig,
}: UseRevokeMandateOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: revokeMandate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
