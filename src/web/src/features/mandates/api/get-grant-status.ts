import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type QueryConfig } from '@/lib/react-query';
import { type Amount } from '@/types/api';

// GET /demo/status — ¿Juan ya aprobó el grant raíz en su billetera? y si el
// gateway corre contra el Test Wallet o con Open Payments simulado.
export type Asset = Pick<Amount, 'assetCode' | 'assetScale'>;

export const COP: Asset = { assetCode: 'COP', assetScale: 2 };

export type GrantStatus = {
  rootGrant: boolean;
  mockOp: boolean;
  fxCopPerUsd?: number;
  // Moneda de la wallet de Juan
  asset?: Asset;
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
