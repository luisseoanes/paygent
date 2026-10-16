import * as React from 'react';

import { useOnline } from '@/hooks/use-online';

import {
  getMandatoDispositivo,
  vincularDispositivo,
} from '../api/vincular-dispositivo';
import { useDispositivoStore } from '../stores/dispositivo-store';

const UN_DIA = 24 * 3600_000;

// Con señal: trae el saldo real del periodo y, si María ya gastó sin señal o
// el certificado está por vencer, pide uno nuevo (reinicia el tope sin señal).
export const useRefrescarDispositivo = () => {
  const online = useOnline();
  const dispositivo = useDispositivoStore((s) => s.dispositivo);
  const guardar = useDispositivoStore((s) => s.guardar);
  const certId = dispositivo?.cert.certId;

  React.useEffect(() => {
    const d = useDispositivoStore.getState().dispositivo;
    if (!online || !d) return;
    let cancelado = false;
    const renovar =
      d.counter > 0 ||
      new Date(d.cert.expiresAt).getTime() - Date.now() < UN_DIA;
    (renovar
      ? vincularDispositivo({ mandateId: d.mandateId, previo: d })
      : getMandatoDispositivo(d.mandateId).then((m) => ({
          ...d,
          categories: m.categories,
          remaining: m.remaining,
          remainingAt: new Date().toISOString(),
        }))
    )
      .then((siguiente) => {
        if (!cancelado) guardar(siguiente);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [online, certId, guardar]);
};
