import type * as React from 'react';

import { EstadoConexion } from '@/components/brand/estado-conexion';
import { Link } from '@/components/ui/link';
import { paths } from '@/config/paths';
import { useOnline } from '@/hooks/use-online';

import { Wordmark } from './site-header';

// Marco de las apps de rol (María, tendero): pantalla de celular, sin el menú
// de la portada. Arriba, quién eres y si hay señal; el resto es la tarea.
export const AppShell = ({
  rol,
  children,
}: {
  rol: string;
  children: React.ReactNode;
}) => {
  const online = useOnline();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-3 px-4">
          <Link
            to={paths.home.getHref()}
            variant="unstyled"
            aria-label="Paygent, ir a la portada"
            className="flex min-w-0 items-center gap-2"
          >
            <Wordmark />
            <span className="truncate text-sm text-ink-2">· {rol}</span>
          </Link>
          <EstadoConexion online={online} />
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-2 pb-8"
      >
        {children}
      </main>
    </div>
  );
};
