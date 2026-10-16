import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { type QueryConfig } from '@/lib/react-query';
import { type MandateTree } from '@/types/api';

// GET /mandates/:id/tree — árbol de mandatos con el gasto del periodo.
export const getMandateTree = (mandateId: string): Promise<MandateTree> =>
  api.get(`/mandates/${mandateId}/tree`);

export const getMandateTreeQueryOptions = (mandateId: string) =>
  queryOptions({
    queryKey: ['mandates', mandateId, 'tree'],
    queryFn: () => getMandateTree(mandateId),
  });

type UseMandateTreeOptions = {
  mandateId: string;
  queryConfig?: QueryConfig<typeof getMandateTreeQueryOptions>;
};

export const useMandateTree = ({
  mandateId,
  queryConfig,
}: UseMandateTreeOptions) =>
  useQuery({ ...getMandateTreeQueryOptions(mandateId), ...queryConfig });
