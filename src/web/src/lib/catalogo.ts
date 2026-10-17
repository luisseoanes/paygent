import { amount as A, type Merchant } from '@openroute/shared';

import { formatDate } from '@/utils/format';

import { api } from './api-client';

// Datos de solo lectura que María y el tendero descargan con señal y guardan
// para trabajar sin ella: comercios, llave pública del gateway y TRM.

export const getMerchants = async (): Promise<Merchant[]> =>
  ((await api.get('/merchants')) as unknown as Merchant[]).filter(
    (m) => !m.isAgent,
  );

export const getGatewayPublicKey = async (): Promise<string> =>
  ((await api.get('/gateway/public-key')) as unknown as { publicKey: string })
    .publicKey;

// TRM del día que publica la api (GET /fx); sin ella, la de respaldo.
export type Fx = {
  copPerUsd: number;
  // Día en que vale (Bogotá); null si la api usa la tasa de respaldo
  fecha: string | null;
  fuente: 'trm' | 'respaldo';
};

export const getFx = async (): Promise<Fx> => {
  const fx = (await api.get('/fx')) as unknown as Partial<Fx>;
  return fx.copPerUsd
    ? { copPerUsd: fx.copPerUsd, fecha: fx.fecha ?? null, fuente: fx.fuente ?? 'respaldo' }
    : { copPerUsd: A.DEFAULT_FX_COP_PER_USD, fecha: null, fuente: 'respaldo' };
};

// "TRM del 16 de octubre" o "tasa de referencia" si no hay TRM.
export const etiquetaTasa = (fecha?: string | null) =>
  fecha
    ? `TRM del ${formatDate(`${fecha}T12:00:00`, { day: 'numeric', month: 'long' })}`
    : 'tasa de referencia';
