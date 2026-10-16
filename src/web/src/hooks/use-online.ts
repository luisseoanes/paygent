import * as React from 'react';

// ¿Hay red? Escucha los eventos online/offline del navegador.
export const useOnline = () =>
  React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
