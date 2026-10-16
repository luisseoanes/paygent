import { useMutation } from '@tanstack/react-query';
import * as z from 'zod';

import { api } from '@/lib/api-client';
import { type MutationConfig } from '@/lib/react-query';
import { type Amount } from '@/types/api';

import {
  buildInterval,
  parseMoney,
  periodos,
  toAmount,
} from '../utils/mandate';

import { type Asset } from './get-grant-status';

// POST /mandates/root — pide el grant interactivo de Open Payments con
// debitAmount + interval y devuelve la URL de consentimiento del Test Wallet.
// Al aprobar (o rechazar), apps/api redirige a /juan?ok=1 (u ?ok=0).

export const createRootMandateInputSchema = z.object({
  maxDebit: z
    .string()
    .trim()
    .min(1, 'Escribe el tope')
    .transform(parseMoney)
    .refine((n) => Number.isFinite(n) && n > 0, 'Escribe un monto mayor a 0'),
  periodo: z.enum(periodos),
});

export type CreateRootMandateInput = z.input<
  typeof createRootMandateInputSchema
>;
export type CreateRootMandateValues = z.output<
  typeof createRootMandateInputSchema
>;

export type CreateRootMandateBody = {
  walletAddress?: string;
  maxDebit: Amount;
  interval: string;
};

// El tope va en la moneda de la wallet de Juan (COP en el hackatón).
export const toRootMandateBody = (
  values: CreateRootMandateValues,
  asset: Asset,
  walletAddress?: string,
): CreateRootMandateBody => ({
  walletAddress,
  maxDebit: toAmount(values.maxDebit, { value: '0', ...asset }),
  interval: buildInterval(values.periodo),
});

export const createRootMandate = (
  data: CreateRootMandateBody,
): Promise<{ redirectUrl: string }> => api.post('/mandates/root', data);

type UseCreateRootMandateOptions = {
  mutationConfig?: MutationConfig<typeof createRootMandate>;
};

export const useCreateRootMandate = ({
  mutationConfig,
}: UseCreateRootMandateOptions = {}) =>
  useMutation({ ...mutationConfig, mutationFn: createRootMandate });
