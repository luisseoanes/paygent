import { type Amount, type Payment } from '@openroute/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type QueryConfig } from '@/lib/react-query';

// GET /merchants/:id/payments — todo lo que recibió la tienda (vales de
// cualquier celular y compras del Asistente), del más nuevo al más viejo.
export type Cobro = Payment & { received: Amount };

export const getCobros = (merchantId: string): Promise<Cobro[]> =>
  api.get(`/merchants/${merchantId}/payments`);

export const getCobrosQueryOptions = (merchantId: string) =>
  queryOptions({
    queryKey: ['merchants', merchantId, 'payments'],
    queryFn: () => getCobros(merchantId),
  });

type UseCobrosOptions = {
  merchantId: string;
  queryConfig?: QueryConfig<typeof getCobrosQueryOptions>;
};

export const useCobros = ({ merchantId, queryConfig }: UseCobrosOptions) =>
  useQuery({ ...getCobrosQueryOptions(merchantId), ...queryConfig });
