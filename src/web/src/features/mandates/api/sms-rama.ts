import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as z from 'zod';

import { api } from '@/lib/api-client';
import { currentUserId } from '@/lib/auth';
import { type MutationConfig, type QueryConfig } from '@/lib/react-query';

// GET/PUT/DELETE /mandates/:id/sms — el titular activa el SMS de una rama: el celular con el que su beneficiario
// le escribe al Asistente y el PIN con el que confirma. La api normaliza el número y decide si el PIN sirve.

export type EstadoSms =
  { active: false } | { active: true; phone: string; mandateId: string };

export const activarSmsInputSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^[+\d\s().-]{7,20}$/, 'Escribe un celular, ej. 300 111 2233'),
    pin: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Exactamente 4 números'),
    confirm: z.string().trim(),
  })
  .refine((v) => v.pin === v.confirm, {
    path: ['confirm'],
    message: 'Los PIN no coinciden',
  });

export type ActivarSmsValues = z.output<typeof activarSmsInputSchema>;

const comoTitular = () => ({ headers: { 'x-user-id': currentUserId() ?? '' } });

export const getSmsRama = (mandateId: string): Promise<EstadoSms> =>
  api.get(`/mandates/${mandateId}/sms`, comoTitular());

export const getSmsRamaQueryOptions = (mandateId: string) =>
  queryOptions({
    queryKey: ['mandates', mandateId, 'sms'],
    queryFn: () => getSmsRama(mandateId),
  });

type UseSmsRamaOptions = {
  mandateId: string;
  queryConfig?: QueryConfig<typeof getSmsRamaQueryOptions>;
};

export const useSmsRama = ({ mandateId, queryConfig }: UseSmsRamaOptions) =>
  useQuery({ ...getSmsRamaQueryOptions(mandateId), ...queryConfig });

export const activarSms = ({
  mandateId,
  data,
}: {
  mandateId: string;
  data: { phone: string; pin: string };
}): Promise<EstadoSms> =>
  api.put(`/mandates/${mandateId}/sms`, data, comoTitular());

export const apagarSms = ({
  mandateId,
}: {
  mandateId: string;
}): Promise<EstadoSms> =>
  api.delete(`/mandates/${mandateId}/sms`, comoTitular());

// El árbol también cambia (la hoja del Asistente): se refresca todo ['mandates'].
const useRefrescarMandatos = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['mandates'] });
};

export const useActivarSms = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof activarSms> } = {}) => {
  const refrescar = useRefrescarMandatos();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: activarSms,
    onSuccess: (...args) => {
      refrescar();
      onSuccess?.(...args);
    },
  });
};

export const useApagarSms = ({
  mutationConfig,
}: { mutationConfig?: MutationConfig<typeof apagarSms> } = {}) => {
  const refrescar = useRefrescarMandatos();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: apagarSms,
    onSuccess: (...args) => {
      refrescar();
      onSuccess?.(...args);
    },
  });
};
