import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProvider } from '@/app/provider';
import { paths } from '@/config/paths';
import { rtlRender, screen, userEvent, waitFor } from '@/testing/test-utils';

import LoginRoute from '../auth/login';

// Las rutas de María y del tendero se reemplazan por marcadores: aquí se
// prueba a dónde lleva cada cuenta, no las apps.
const setup = (url: string) => {
  const router = createMemoryRouter(
    [
      { path: paths.auth.login.path, element: <LoginRoute /> },
      { path: paths.juan.path, element: <p>app de juan</p> },
      { path: paths.maria.path, element: <p>app de maría</p> },
      { path: paths.tendero.path, element: <p>app del tendero</p> },
    ],
    { initialEntries: [url] },
  );
  rtlRender(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return router;
};

test.each([
  ['María', /^maría$/i, paths.maria.path],
  ['Tendero', /^tendero$/i, paths.tendero.path],
])('the %s demo account lands on its own app', async (_, cuenta, destino) => {
  const router = setup(paths.auth.login.getHref());

  await userEvent.click(await screen.findByRole('button', { name: cuenta }));
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe(destino));
});
