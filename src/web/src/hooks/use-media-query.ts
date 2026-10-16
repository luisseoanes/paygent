import * as React from 'react';

// ¿Se cumple la media query? Se actualiza al cambiar el tamaño de la ventana.
export const useMediaQuery = (query: string) =>
  React.useSyncExternalStore(
    (avisar) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', avisar);
      return () => mql.removeEventListener('change', avisar);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
