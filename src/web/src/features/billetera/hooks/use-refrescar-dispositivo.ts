import * as React from 'react';

import { useOnline } from '@/hooks/use-online';
import { getFx } from '@/lib/catalogo';

import {
  getMandatoDispositivo,
  saldoDePersona,
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
// el tope sin señal. Si la rama está congelada o ya no existe, deja de firmar
// vales. La TRM se actualiza en cada revisión: un vale nunca sale con la de ayer.
// `activo` en falso (un celular de otra cuenta) no lo toca.
export const useRefrescarDispositivo = ({ activo = true } = {}) => {
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
    if (!online || !d || !activo) return;
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
          : Promise.all([
              saldoDePersona(d.mandateId, m),
              getFx().catch(() => undefined),
            ]).then(([remaining, fx]) => ({
              ...d,
              categories: m.categories,
              remaining,
              remainingAt: new Date().toISOString(),
              topeMaximo: m.offlineCapCeiling,
              ...(fx && { fx: fx.copPerUsd, fxFecha: fx.fecha }),
            }));
      })
      .then((siguiente) => {
        if (!cancelado) guardar(siguiente);
      })
      .catch((err: { response?: { status?: number } }) => {
        // La rama se borró (la raíz se volvió a aprobar sin beneficiarios): su certificado ya no se cobra.
        if (!cancelado && err.response?.status === 404)
          guardar({ ...d, congelado: true });
      });
    return () => {
      cancelado = true;
    };
  }, [online, activo, certId, guardar, pulso]);
};
