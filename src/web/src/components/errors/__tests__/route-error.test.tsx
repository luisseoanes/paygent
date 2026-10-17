import { createMemoryRouter, RouterProvider } from 'react-router';

import * as version from '@/lib/version';
import { rtlRender, screen } from '@/testing/test-utils';

import { RouteError } from '../route-error';

vi.mock('@/lib/version', async (original) => ({
  ...(await original<typeof version>()),
  recargarPorVersionNueva: vi.fn(),
}));

const viejo = () =>
  new TypeError(
    'Failed to fetch dynamically imported module: /assets/landing-OLD.js',
  );

// El error salta al pintar la ruta (un loader no sirve en jsdom con Node 24: AbortSignal).
const conError = (error: unknown) => {
  const Lanza = () => {
    throw error;
  };
  return rtlRender(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: '/',
            errorElement: <RouteError />,
            element: <Lanza />,
          },
        ],
        { initialEntries: ['/'] },
      )}
    />,
  );
};

test('the way back loads the home page from scratch, so it works even if the app in memory is broken', async () => {
  conError(new Error('boom'));
  const volver = await screen.findByRole('link', {
    name: 'Volver a la página principal',
  });
  // Un enlace normal (no del router): recarga la app entera desde el servidor.
  expect(volver).toHaveAttribute('href', '/');
});

test('an old tab after a deploy reloads itself where you were going', async () => {
  vi.mocked(version.recargarPorVersionNueva).mockReturnValue(true);
  conError(viejo());
  expect(
    await screen.findByText(/cargando la versión nueva/i),
  ).toBeInTheDocument();
  expect(version.recargarPorVersionNueva).toHaveBeenCalled();
});

test('if it already reloaded, it explains instead of looping', async () => {
  vi.mocked(version.recargarPorVersionNueva).mockReturnValue(false);
  conError(viejo());
  expect(
    await screen.findByRole('heading', { name: /versión nueva/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Volver a la página principal' }),
  ).toHaveAttribute('href', '/');
});
