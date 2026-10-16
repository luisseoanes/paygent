import * as React from 'react';

import { useOnline } from '@/hooks/use-online';

import {
  getMandatoDispositivo,
  vincularDispositivo,
} from '../api/vincular-dispositivo';
import {
  type Dispositivo,
  useDispositivoStore,
} from '../stores/dispositivo-store';

const UN_DIA = 24 * 3600_000;
const CADA_MINUTO = 60_000;

// Con señal: trae el saldo real del periodo y pide un certificado nuevo si María
// ya gastó sin señal, si el certificado está por vencer o si el Guardián cambió
// el tope sin señal. Si la rama está congelada, deja de firmar vales.
export const useRefrescarDispositivo = () => {
  const online = useOnline();
  const dispositivo = useDispositivoStore((s) => s.dispositivo);
  const guardar = useDispositivoStore((s) => s.guardar);
  const certId = dispositivo?.cert.certId;
  // Con señal se revisa cada minuto: un congelamiento o un tope nuevo del Guardián llega aunque la app siga abierta.
  const [pulso, setPulso] = React.useState(0);
  React.useEffect(() => {
    if (!online) return;
    const t = setInterval(() => setPulso((p) => p + 1), CADA_MINUTO);
    return () => clearInterval(t);
  }, [online]);

  React.useEffect(() => {
    const d = useDispositivoStore.getState().dispositivo;
    if (!online || !d) return;
    let cancelado = false;
    getMandatoDispositivo(d.mandateId)
      .then((m): Dispositivo | Promise<Dispositivo> => {
        if (m.frozen || m.revoked)
          return { ...d, congelado: true, topeMaximo: m.offlineCapCeiling };
        const topeCambio =
          !!m.offlineCap &&
          (m.offlineCap.value !== d.cert.offlineCap.value ||
            m.offlineCap.assetCode !== d.cert.offlineCap.assetCode);
        const renovar =
          d.counter > 0 ||
          topeCambio ||
          d.congelado ||
          new Date(d.cert.expiresAt).getTime() - Date.now() < UN_DIA;
        return renovar
          ? vincularDispositivo({ mandateId: d.mandateId, previo: d }).then(
              (n) => ({ ...n, congelado: false }),
            )
          : {
              ...d,
              categories: m.categories,
              remaining: m.remaining,
              remainingAt: new Date().toISOString(),
              topeMaximo: m.offlineCapCeiling,
            };
      })
      .then((siguiente) => {
        if (!cancelado) guardar(siguiente);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [online, certId, guardar, pulso]);
};
