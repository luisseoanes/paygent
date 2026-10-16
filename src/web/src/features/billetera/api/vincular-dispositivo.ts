import {
  type Amount,
  type DeviceCert,
  type Mandate,
  generateKeyPair,
} from '@openroute/shared';
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { getFxCopPerUsd, getMerchants } from '@/lib/catalogo';
import { type MutationConfig } from '@/lib/react-query';

import {
  type Dispositivo,
  useDispositivoStore,
} from '../stores/dispositivo-store';

// OFF-02 / OFF-04: el celular genera su par de llaves (la privada nunca sale),
// registra la pública en la rama y recibe un certificado firmado por el
// gateway con su tope sin señal. Cada certificado nuevo reinicia contador y
// acumulado. De paso descarga lo necesario para pagar en modo avión.

export type DeviceKeyResponse = {
  deviceKeyId: string;
  cert: DeviceCert;
  offlineCap: Amount;
  gatewayPublicKey: string;
};

export type MandatoDispositivo = Mandate & { remaining?: Amount };

export const getMandatoDispositivo = (
  mandateId: string,
): Promise<MandatoDispositivo> => api.get(`/mandates/${mandateId}`);

export const vincularDispositivo = async ({
  mandateId,
  previo,
}: {
  mandateId: string;
  // Al renovar se conservan las llaves y el historial
  previo?: Dispositivo | null;
}): Promise<Dispositivo> => {
  const keys =
    previo && previo.mandateId === mandateId
      ? { publicKey: previo.publicKey, secretKey: previo.secretKey }
      : generateKeyPair();
  const res: DeviceKeyResponse = await api.post(
    `/mandates/${mandateId}/device-key`,
    { publicKey: keys.publicKey },
  );
  const [merchants, fx, mandato] = await Promise.all([
    getMerchants(),
    getFxCopPerUsd(),
    getMandatoDispositivo(mandateId).catch(() => undefined),
  ]);
  return {
    mandateId,
    ...keys,
    cert: res.cert,
    gatewayPublicKey: res.gatewayPublicKey,
    counter: 0,
    cumulativeCents: 0,
    merchants,
    fx,
    categories: mandato?.categories,
    remaining: mandato?.remaining,
    topeMaximo: mandato?.offlineCapCeiling,
    remainingAt: mandato ? new Date().toISOString() : undefined,
    vales: previo?.mandateId === mandateId ? previo.vales : [],
  };
};

type UseVincularOptions = {
  mutationConfig?: MutationConfig<typeof vincularDispositivo>;
};

export const useVincularDispositivo = ({
  mutationConfig,
}: UseVincularOptions = {}) => {
  const guardar = useDispositivoStore((s) => s.guardar);
  const { onSuccess, ...restConfig } = mutationConfig ?? {};
  return useMutation({
    ...restConfig,
    mutationFn: vincularDispositivo,
    onSuccess: async (...args) => {
      await guardar(args[0]);
      onSuccess?.(...args);
    },
  });
};
