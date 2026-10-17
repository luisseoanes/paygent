import * as React from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { Heading, Text } from '@/components/ui/typography';
import { paths } from '@/config/paths';
import { esErrorDeVersion, recargarPorVersionNueva } from '@/lib/version';

// Rendered by the router when a route (loader, action or render) throws.
export const RouteError = () => {
  const error = useRouteError();

  // En desarrollo, deja el error real en la consola.
  if (import.meta.env.DEV) console.error(error);

  // Pestaña abierta con una versión anterior: sus trozos ya no existen. Aquí la
  // URL ya es la de destino, así que recargar lleva justo adonde ibas.
  const version = esErrorDeVersion(error);
  const [recargando, setRecargando] = React.useState(false);
  React.useEffect(() => {
    if (version && recargarPorVersionNueva()) setRecargando(true);
  }, [version]);

  if (recargando)
    return (
      <div
        role="status"
        className="flex min-h-[60dvh] items-center justify-center p-6 text-center"
      >
        <Text variant="muted">Cargando la versión nueva de Paygent…</Text>
      </div>
    );
  const message = version
    ? 'Esta pestaña tenía una versión anterior de Paygent. Vuelve a cargarla; tu sesión y tus datos siguen intactos.'
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : 'Ocurrió un error inesperado.';

  return (
    <div
      role="alert"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Heading level="h2">
        {version ? 'Hay una versión nueva' : 'Algo se rompió'}
      </Heading>
      <Text variant="muted">{message}</Text>
      {/* Enlace normal, no del router: carga la página de cero aunque la app en memoria esté rota. */}
      <a
        href={paths.home.getHref()}
        className="font-medium text-ink underline decoration-rule-strong underline-offset-4 transition-colors hover:decoration-ink"
      >
        Volver a la página principal
      </a>
    </div>
  );
};
