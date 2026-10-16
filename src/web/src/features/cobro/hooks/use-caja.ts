import * as React from 'react';

import { useOnline } from '@/hooks/use-online';
import {
  getFxCopPerUsd,
  getGatewayPublicKey,
  getMerchants,
} from '@/lib/catalogo';

import { cobrarVales } from '../api/cobrar-vales';
import { useCobroStore } from '../stores/cobro-store';

// Mantiene la caja al día: con señal descarga comercios, llave del gateway y
// tasa (para verificar sin red) y cobra sola la cola pendiente (OFF-06).
export const useCaja = () => {
  const online = useOnline();
  const cargado = useCobroStore((s) => s.cargado);
  const cargar = useCobroStore((s) => s.cargar);
  const configurar = useCobroStore((s) => s.configurar);
  const aplicarResultados = useCobroStore((s) => s.aplicarResultados);
  const pendientes = useCobroStore(
    (s) => s.vales.filter((v) => v.status === 'pending').length,
  );
  const [sincronizando, setSincronizando] = React.useState(false);
  const enCurso = React.useRef(false);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  React.useEffect(() => {
    if (!online || !cargado) return;
    Promise.all([getMerchants(), getGatewayPublicKey(), getFxCopPerUsd()])
      .then(([merchants, gatewayPublicKey, fx]) =>
        configurar({ merchants, gatewayPublicKey, fx }),
      )
      .catch(() => {});
  }, [online, cargado, configurar]);

  const sincronizar = React.useCallback(async () => {
    const cola = useCobroStore
      .getState()
      .vales.filter((v) => v.status === 'pending');
    if (enCurso.current || cola.length === 0) return;
    enCurso.current = true;
    setSincronizando(true);
    try {
      await aplicarResultados(await cobrarVales(cola.map((v) => v.voucher)));
    } catch {
      // sigue en la cola: se reintenta en la próxima conexión
    } finally {
      enCurso.current = false;
      setSincronizando(false);
    }
  }, [aplicarResultados]);

  React.useEffect(() => {
    if (online && cargado && pendientes > 0) sincronizar();
  }, [online, cargado, pendientes, sincronizar]);

  return { online, cargado, sincronizando, pendientes, sincronizar };
};
