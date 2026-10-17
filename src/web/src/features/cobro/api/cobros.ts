import {
  type Merchant,
  type Payout,
  type PuntoredCredit,
} from '@openroute/shared';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';

// Cómo cobra la tienda y lo que Puntored le acreditó (si cobra sin wallet).
// GET /merchants/:id/credits y PUT /merchants/:id/payout: solo su tendero.

export const getAcreditaciones = (
  merchantId: string,
): Promise<PuntoredCredit[]> => api.get(`/merchants/${merchantId}/credits`);

export const getAcreditacionesQueryOptions = (merchantId: string) =>
  queryOptions({
    queryKey: ['merchants', merchantId, 'credits'],
    queryFn: () => getAcreditaciones(merchantId),
    // Llegan solas al cobrar: se revisan seguido mientras la caja está abierta.
    refetchInterval: 15_000,
  });

export const useAcreditaciones = (merchantId?: string) =>
  useQuery({
    ...getAcreditacionesQueryOptions(merchantId ?? ''),
    enabled: !!merchantId,
  });

export const cambiarCobro = ({
  merchantId,
  payout,
}: {
  merchantId: string;
  payout: Payout;
}): Promise<Merchant> => api.put(`/merchants/${merchantId}/payout`, payout);

export const useCambiarCobro = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof cambiarCobro> } = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: cambiarCobro,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      onSuccess?.(...args);
    },
  });
};
