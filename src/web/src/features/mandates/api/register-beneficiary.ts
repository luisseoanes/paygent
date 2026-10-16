import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';
import { type Amount } from '@/types/api';

import { money, parseMoney } from '../utils/mandate';

// POST /mandates/:raíz/beneficiaries — el titular registra a un beneficiario. Siempre sale de su raíz (todo el
// dinero sale de su cuenta): alias, tope por periodo, PIN y tope sin señal, los cuatro obligatorios. La api
// devuelve el código con el que el beneficiario enlaza su cuenta en /enlazar.

const monto = z
  .string()
  .trim()
  .min(1, 'Escribe el monto')
  .transform(parseMoney)
  .refine(
    (n) => Number.isFinite(n) && n > 0,
    'Escribe un monto mayor que cero',
  );

export const createRegisterBeneficiaryInputSchema = (disponible: number) =>
  z
    .object({
      alias: z.string().trim().min(2, 'Escribe cómo lo verás en tu panel'),
      maxDebit: monto.refine(
        (n) => n <= disponible,
        `Solo puedes repartir ${money(disponible)}`,
      ),
      pin: z
        .string()
        .trim()
        .regex(/^\d{4,6}$/, 'De 4 a 6 números'),
      offlineCap: monto,
    })
    .refine((v) => v.offlineCap <= v.maxDebit, {
      path: ['offlineCap'],
      message: 'No puede superar el tope por periodo',
    });

export type RegisterBeneficiaryValues = z.output<
  ReturnType<typeof createRegisterBeneficiaryInputSchema>
>;

export type RegisterBeneficiaryBody = {
  alias: string;
  maxDebit: Amount;
  offlineCap: Amount;
  pin: string;
};

export const registerBeneficiary = ({
  rootMandateId,
  data,
}: {
  rootMandateId: string;
  data: RegisterBeneficiaryBody;
}): Promise<{ code: string; mandateId: string }> =>
  api.post(`/mandates/${rootMandateId}/beneficiaries`, data);

type UseRegisterBeneficiaryOptions = {
  mutationConfig?: MutationConfig<typeof registerBeneficiary>;
};

export const useRegisterBeneficiary = ({
  mutationConfig,
}: UseRegisterBeneficiaryOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: registerBeneficiary,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
