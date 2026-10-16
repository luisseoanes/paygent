import { type Merchant } from '@openroute/shared';

import { api } from './api-client';

// Datos de solo lectura que María y el tendero descargan con señal y guardan
// para trabajar sin ella: comercios, llave pública del gateway y tasa COP.

export const getMerchants = async (): Promise<Merchant[]> =>
  ((await api.get('/merchants')) as unknown as Merchant[]).filter(
    (m) => !m.isAgent,
  );

export const getGatewayPublicKey = async (): Promise<string> =>
  ((await api.get('/gateway/public-key')) as unknown as { publicKey: string })
    .publicKey;

// Tasa de referencia COP por USD (simulada, OP-10).
export const getFxCopPerUsd = async (): Promise<number> =>
  (
    (await api.get('/demo/status')) as unknown as {
      fxCopPerUsd?: number;
    }
  ).fxCopPerUsd ?? 4000;
