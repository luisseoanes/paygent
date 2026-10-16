import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProvider } from '@/app/provider';
import { paths } from '@/config/paths';
import { RegistroBeneficiarioForm } from '@/features/auth/components/registro-beneficiario-form';
import { ProtectedRoute } from '@/lib/auth';
import {
  cleanup,
  rtlRender,
  screen,
  userEvent,
  waitFor,
} from '@/testing/test-utils';

import LoginRoute from '../auth/login';
import RegistroRoute from '../auth/registro';
import LegadoRoute from '../legado';
import AppRoot from '../root';

// Las apps se reemplazan por marcadores: aquí se prueba a dónde lleva cada
// cuenta y el registro, no las apps.
const setup = (url: string) => {
  const router = createMemoryRouter(
    [
      { path: paths.auth.login.path, element: <LoginRoute /> },
      { path: paths.auth.registro.path, element: <RegistroRoute /> },
      { path: paths.cuenta.path, element: <p>cuenta del titular</p> },
      { path: paths.billetera.path, element: <p>billetera</p> },
      { path: paths.tendero.path, element: <p>caja del tendero</p> },
      { path: paths.enlazar.path, element: <p>enlazar</p> },
      { path: paths.legado.juan.path, element: <LegadoRoute /> },
      { path: paths.legado.maria.path, element: <LegadoRoute /> },
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

const iniciar = async (correo: string, clave: string) => {
  await userEvent.type(await screen.findByLabelText(/correo/i), correo);
  await userEvent.type(screen.getByLabelText(/contraseña/i), clave);
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );
};

test.each([
  ['Beneficiario', /^beneficiario$/i, paths.billetera.path],
  ['Tendero', /^tendero$/i, paths.tendero.path],
])('the %s demo account lands on its own app', async (_, cuenta, destino) => {
  const router = setup(paths.auth.login.getHref());

  await userEvent.click(await screen.findByRole('button', { name: cuenta }));
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe(destino));
});

test('a new titular registers with their wallet and can sign in again', async () => {
  const router = setup(paths.auth.registro.getHref());

  await userEvent.type(
    await screen.findByLabelText(/número de documento/i),
    '1020304050',
  );
  await userEvent.type(screen.getByLabelText(/^nombre$/i), 'Ana');
  await userEvent.type(screen.getByLabelText(/apellido/i), 'Restrepo');
  await userEvent.type(screen.getByLabelText(/correo/i), 'ana@correo.co');
  await userEvent.type(screen.getByLabelText(/celular/i), '+57 301 555 0100');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'clave-segura');
  await userEvent.type(
    screen.getByLabelText(/wallet address/i),
    '$ilp.interledger-test.dev/ana',
  );
  await userEvent.click(
    screen.getByRole('button', { name: /crear mi cuenta/i }),
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(paths.cuenta.path),
  );
  // La contraseña no queda en claro en el navegador.
  // La cuenta vive en la api: en el navegador no queda la contraseña.
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
    'clave-segura',
  );

  // Otra visita (sin sesión): entra con lo que registró.
  cleanup();
  sessionStorage.clear();
  const otraVisita = setup(paths.auth.login.getHref());
  await iniciar('ana@correo.co', 'clave-segura');
  await waitFor(() =>
    expect(otraVisita.state.location.pathname).toBe(paths.cuenta.path),
  );
});

test('registering checks the wallet address and the fields', async () => {
  setup(paths.auth.registro.getHref());

  await userEvent.type(
    await screen.findByLabelText(/wallet address/i),
    'no-es-una-wallet',
  );
  await userEvent.click(
    screen.getByRole('button', { name: /crear mi cuenta/i }),
  );

  expect(
    await screen.findByText(/escribe tu wallet address/i),
  ).toBeInTheDocument();
  expect(screen.getByText(/solo números, entre 6 y 12/i)).toBeInTheDocument();
});

test('old links still work: /juan → /cuenta and /maria?vincular → /enlazar', async () => {
  const router = setup('/juan?ok=1');
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(paths.cuenta.path),
  );
  expect(router.state.location.search).toBe('?ok=1');

  await router.navigate('/maria?vincular=maria-device');
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(paths.enlazar.path),
  );
  expect(router.state.location.search).toBe('?codigo=maria-device');
});

test('after linking, a beneficiary registers without a wallet and gets in', async () => {
  const onSuccess = vi.fn();
  rtlRender(
    <AppProvider>
      <RegistroBeneficiarioForm
        mandateId="maria-device"
        onSuccess={onSuccess}
      />
    </AppProvider>,
  );

  expect(screen.queryByLabelText(/wallet/i)).not.toBeInTheDocument();
  await userEvent.type(await screen.findByLabelText(/^nombre$/i), 'Lucía');
  await userEvent.type(
    screen.getByLabelText(/número de documento/i),
    '43210987',
  );
  await userEvent.type(screen.getByLabelText(/correo/i), 'lucia@correo.co');
  await userEvent.type(screen.getByLabelText(/teléfono/i), '3105550100');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'otra-clave');
  await userEvent.click(
    screen.getByRole('button', { name: /terminar registro/i }),
  );

  await waitFor(() =>
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'beneficiario',
        name: 'Lucía',
        mandateId: 'maria-device',
      }),
    ),
  );
});

test('from the account menu you can sign out from any screen', async () => {
  sessionStorage.setItem('paygent-session', 'juan');
  const router = createMemoryRouter(
    [
      {
        element: <AppRoot />,
        children: [
          { path: paths.home.path, element: <p>portada</p> },
          {
            path: paths.cuenta.path,
            element: (
              <ProtectedRoute rol="titular">
                <p>cuenta del titular</p>
              </ProtectedRoute>
            ),
          },
        ],
      },
    ],
    { initialEntries: [paths.cuenta.getHref()] },
  );
  rtlRender(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );

  await userEvent.click(
    await screen.findByRole('button', { name: /cuenta de juan pérez/i }),
  );
  expect(screen.getByText('juan@paygent.dev')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(paths.home.path),
  );
  await waitFor(() =>
    expect(sessionStorage.getItem('paygent-session')).toBeNull(),
  );
  expect(
    await screen.findByRole('link', { name: /iniciar sesión/i }),
  ).toBeInTheDocument();
});
