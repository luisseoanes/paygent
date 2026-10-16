import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';
import {
  type Amount,
  type Category,
  type HolderType,
  type Mandate,
} from '@/types/api';

import { money, parseMoney } from '../utils/mandate';

// POST /mandates/:id/delegate — crea una rama hija. El gateway exige que la
// suma de hijos no supere al padre, que las categorías sean un subconjunto de
// las suyas y que no venza después. El formulario valida lo mismo antes.

export type PadreDelegable = {
  id: string;
  // Lo que aún puede repartir: su tope menos el de sus hijos activos
  disponible: number;
  categories: Category[];
};

const montoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : parseMoney(v)))
  .refine(
    (n) => n === undefined || (Number.isFinite(n) && n >= 0),
    'Escribe un monto válido',
  );

export const createDelegateInputSchema = (padres: PadreDelegable[]) =>
  z
    .object({
      parentId: z.string().min(1, 'Elige de qué rama sale'),
      holderType: z.enum(['person', 'device', 'agent']),
      holderName: z.string().trim().min(2, 'Escribe un nombre'),
      holderId: z.string().trim().min(3, 'Escribe quién la usa'),
      maxDebit: z
        .string()
        .trim()
        .min(1, 'Escribe el tope')
        .transform(parseMoney)
        .refine(
          (n) => Number.isFinite(n) && n > 0,
          'Escribe un monto mayor a 0',
        ),
      // Un solo checkbox marcado llega como string; ninguno, como false.
      categories: z.preprocess(
        (v) => (Array.isArray(v) ? v : v ? [v] : []),
        z
          .array(z.enum(['mercado', 'farmacia', 'efectivo', 'datos']))
          .min(1, 'Elige al menos una categoría'),
      ),
      pinThreshold: montoOpcional,
      offlineCap: montoOpcional,
    })
    .superRefine((v, ctx) => {
      const padre = padres.find((p) => p.id === v.parentId);
      if (!padre) return;
      if (v.maxDebit > padre.disponible)
        ctx.addIssue({
          code: 'custom',
          path: ['maxDebit'],
          message: `Esa rama solo puede repartir ${money(padre.disponible)}`,
        });
      if (v.categories.some((c) => !padre.categories.includes(c)))
        ctx.addIssue({
          code: 'custom',
          path: ['categories'],
          message: 'Solo las categorías que tiene la rama de origen',
        });
      if (v.offlineCap !== undefined && v.offlineCap > v.maxDebit)
        ctx.addIssue({
          code: 'custom',
          path: ['offlineCap'],
          message: 'No puede superar el tope de la rama',
        });
    });

export type DelegateFormInput = z.input<
  ReturnType<typeof createDelegateInputSchema>
>;
export type DelegateFormValues = z.output<
  ReturnType<typeof createDelegateInputSchema>
>;

export type DelegateMandateBody = {
  holderType: HolderType;
  holderId: string;
  holderName: string;
  maxDebit: Amount;
  categories: Category[];
  pinThreshold?: Amount;
  offlineCap?: Amount;
};

export const delegateMandate = ({
  mandateId,
  data,
}: {
  mandateId: string;
  data: DelegateMandateBody;
}): Promise<Mandate> => api.post(`/mandates/${mandateId}/delegate`, data);

type UseDelegateMandateOptions = {
  mutationConfig?: MutationConfig<typeof delegateMandate>;
};

export const useDelegateMandate = ({
  mutationConfig,
}: UseDelegateMandateOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: delegateMandate,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ['mandates'] });
      onSuccess?.(...args);
    },
  });
};
