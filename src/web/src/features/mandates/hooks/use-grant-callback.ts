import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { useNotifications } from '@/components/ui/notifications';

// Al volver de la billetera, apps/api redirige a /juan?ok=1 (aprobado) o
// /juan?ok=0&error=… (rechazado o falló la continuación del grant). Avisa a
// Juan, refresca el mandato y limpia la URL para que recargar no repita el
// aviso.
export const useGrantCallback = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const addNotification = useNotifications((s) => s.addNotification);
  // StrictMode ejecuta el efecto dos veces: un aviso por navegación.
  const handled = React.useRef<string | null>(null);

  const ok = searchParams.get('ok');
  const error = searchParams.get('error');

  React.useEffect(() => {
    if (ok === null || handled.current === location.key) return;
    handled.current = location.key;

    if (ok === '1')
      addNotification({
        type: 'success',
        title: 'Mandato firmado',
        message: 'Tu billetera aprobó el tope. Ya puedes delegar.',
      });
    else
      addNotification({
        type: 'error',
        title: 'No se firmó. Nada cambió.',
        message: error
          ? `La billetera respondió: ${error.slice(0, 140)}`
          : 'Puedes intentarlo de nuevo cuando quieras.',
      });

    queryClient.invalidateQueries({ queryKey: ['mandates'] });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('ok');
        next.delete('error');
        return next;
      },
      { replace: true },
    );
  }, [ok, error, location.key, addNotification, queryClient, setSearchParams]);
};
