import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';
import { type Amount, type Mandate } from '@/types/api';

// PATCH /mandates/:id/restrict — solo restringe (monotonía): baja el tope sin
// señal o congela/descongela. Ampliar exige firmar un mandato nuevo.
export type RestrictMandateInput = {
  mandateId: string;
  data: { offlineCap?: Amount; frozen?: boolean };
};

export const restrictMandate = ({
  mandateId,
  data,
}: RestrictMandateInput): Promise<Mandate> =>
  api.patch(`/mandates/${mandateId}/restrict`, data);

type UseRestrictMandateOptions = {
  mutationConfig?: MutationConfig<typeof restrictMandate>;
};

export const useRestrictMandate = ({
  mutationConfig,
}: UseRestrictMandateOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: restrictMandate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
