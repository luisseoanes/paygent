import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type QueryConfig } from '@/lib/react-query';

// GET /demo/status — ¿Juan ya aprobó el grant raíz en su billetera? y si el
// gateway corre contra el Test Wallet o con Open Payments simulado.
export type GrantStatus = {
  rootGrant: boolean;
  mockOp: boolean;
  fxCopPerUsd?: number;
};

export const getGrantStatus = (): Promise<GrantStatus> =>
  api.get('/demo/status');

// Bajo ['mandates'] para que revocar, firmar o un evento del feed lo refresquen.
export const getGrantStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['mandates', 'grant-status'],
    queryFn: getGrantStatus,
  });

type UseGrantStatusOptions = {
  queryConfig?: QueryConfig<typeof getGrantStatusQueryOptions>;
};

export const useGrantStatus = ({ queryConfig }: UseGrantStatusOptions = {}) =>
  useQuery({ ...getGrantStatusQueryOptions(), ...queryConfig });
