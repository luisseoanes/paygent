import { isRouteErrorResponse, useRouteError } from 'react-router';

import { Link } from '@/components/ui/link';
import { Heading, Text } from '@/components/ui/typography';
import { paths } from '@/config/paths';

// Rendered by the router when a route (loader, action or render) throws.
export const RouteError = () => {
  const error = useRouteError();

  // En desarrollo, deja el error real en la consola.
  if (import.meta.env.DEV) console.error(error);

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Ocurrió un error inesperado.';

  return (
    <div
      role="alert"
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Heading level="h2">Algo se rompió</Heading>
      <Text variant="muted">{message}</Text>
      <Link to={paths.home.getHref()}>Volver a la portada</Link>
    </div>
  );
};
