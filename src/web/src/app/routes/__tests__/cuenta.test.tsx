import { createMemoryRouter, RouterProvider } from 'react-router';

import { AppProvider } from '@/app/provider';
import { paths } from '@/config/paths';
import { db } from '@/testing/mocks/db';
import {
  rtlRender,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';
import { redirectTo } from '@/utils/redirect';

import LoginRoute from '../auth/login';
import CuentaRoute from '../cuenta';

vi.mock('@/utils/redirect', () => ({ redirectTo: vi.fn() }));

const setupFlow = (url: string, { signedIn = false } = {}) => {
  if (signedIn) sessionStorage.setItem('paygent-session', 'juan');
  const router = createMemoryRouter(
    [
      { path: paths.auth.login.path, element: <LoginRoute /> },
      { path: paths.cuenta.path, element: <CuentaRoute /> },
    ],
    { initialEntries: [url] },
  );
  rtlRender(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );
  return { router };
};

const delegados = () => screen.findByRole('region', { name: /delegados/i });
// Con el cajón abierto la lista queda oculta para el lector: se busca igual.
const lista = () =>
  screen.getByRole('region', { name: /delegados/i, hidden: true });

test('the titular signs in and sees their mandate from the API', async () => {
  const { router } = setupFlow(paths.cuenta.getHref());

  // Sin sesión, /cuenta manda a iniciar sesión.
  await screen.findByRole('heading', { name: /iniciar sesión/i });
  expect(router.state.location.pathname).toBe(paths.auth.login.path);

  await userEvent.type(screen.getByLabelText(/correo/i), 'juan@paygent.dev');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'paygent123');
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );

  expect(
    await screen.findByRole('heading', { name: /hola, juan/i }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(paths.cuenta.path),
  );

  expect(
    within(await delegados()).getByRole('button', {
      name: /^maría: ver detalle$/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText('$300')).toBeInTheDocument();
});

test('wrong credentials are refused with a clear message', async () => {
  setupFlow(paths.auth.login.getHref());

  await screen.findByRole('heading', { name: /iniciar sesión/i });
  await userEvent.type(screen.getByLabelText(/correo/i), 'juan@paygent.dev');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'otraclave1');
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );

  expect(
    await screen.findByText(/correo o contraseña incorrectos/i),
  ).toBeInTheDocument();
});

test('the login form validates before calling the API', async () => {
  setupFlow(paths.auth.login.getHref());

  await screen.findByRole('heading', { name: /iniciar sesión/i });
  await userEvent.click(
    screen.getByRole('button', { name: /iniciar sesión/i }),
  );

  expect(
    await screen.findByText(/escribe un correo válido/i),
  ).toBeInTheDocument();
});

test('without a grant the titular signs a mandate in their wallet', async () => {
  db.rootGrant = false;
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  await screen.findByRole('heading', { name: /firma tu mandato/i });
  const tope = screen.getByLabelText(/tope entre todos/i);
  await userEvent.clear(tope);
  await userEvent.type(tope, '0');
  await userEvent.click(
    screen.getByRole('button', { name: /firmar en mi billetera/i }),
  );
  expect(
    await screen.findByText(/escribe un monto mayor a 0/i),
  ).toBeInTheDocument();

  await userEvent.clear(tope);
  await userEvent.type(tope, '250');
  await userEvent.click(
    screen.getByRole('button', { name: /firmar en mi billetera/i }),
  );

  await waitFor(() =>
    expect(redirectTo).toHaveBeenCalledWith(
      expect.stringMatching(/\/juan\?ok=1$/),
    ),
  );
  expect(db.tree.maxDebit.value).toBe('25000');
});

test('coming back from the wallet tells the titular what happened', async () => {
  const { router } = setupFlow(`${paths.cuenta.getHref()}?ok=0`, {
    signedIn: true,
  });

  expect(
    await screen.findByText(/no se firmó\. nada cambió\./i),
  ).toBeInTheDocument();
  // La URL queda limpia: recargar no repite el aviso.
  await waitFor(() => expect(router.state.location.search).toBe(''));
});

test('the titular registers a beneficiary and gets the code to link them', async () => {
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  await userEvent.click(
    within(await delegados()).getByRole('button', {
      name: /delegar a alguien más/i,
    }),
  );
  const drawer = await screen.findByRole('dialog', { name: /delegar/i });
  expect(
    within(drawer).getByText(/disponible para repartir: \$70/i),
  ).toBeInTheDocument();
  // Solo alias, tope, PIN y tope sin señal: no se elige de dónde sale ni el tipo.
  expect(within(drawer).queryByLabelText(/sale de/i)).not.toBeInTheDocument();
  expect(
    within(drawer).queryByLabelText(/quién la usa/i),
  ).not.toBeInTheDocument();

  await userEvent.type(within(drawer).getByLabelText(/nombre/i), 'Abuela');
  const tope = within(drawer).getByLabelText(/tope por periodo/i);
  const sinSenal = within(drawer).getByLabelText(/tope sin señal/i);
  await userEvent.type(tope, '100');
  await userEvent.type(within(drawer).getByLabelText(/^pin$/i), '1234');
  await userEvent.type(sinSenal, '50');
  const delegar = () =>
    userEvent.click(within(drawer).getByRole('button', { name: /^delegar$/i }));
  await delegar();
  expect(
    await within(drawer).findByText(/solo puedes repartir \$70/i),
  ).toBeInTheDocument();

  await userEvent.clear(tope);
  await userEvent.type(tope, '40');
  await delegar();
  expect(
    await within(drawer).findByText(/no puede superar el tope por periodo/i),
  ).toBeInTheDocument();

  await userEvent.clear(sinSenal);
  await userEvent.type(sinSenal, '10');
  await delegar();

  expect(
    await within(drawer).findByLabelText(/código para enlazar/i),
  ).toHaveTextContent(/^b_/);
  await userEvent.click(
    within(drawer).getByRole('button', { name: /^listo$/i }),
  );
  expect(
    await within(await delegados()).findByRole('button', {
      name: /^abuela: ver detalle$/i,
    }),
  ).toBeInTheDocument();
});

test('the titular freezes a branch and reactivates it', async () => {
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  await userEvent.click(
    within(await delegados()).getByRole('button', {
      name: /^maría: ver detalle$/i,
    }),
  );
  const drawer = await screen.findByRole('dialog', { name: /maría/i });
  await userEvent.click(
    within(drawer).getByRole('button', { name: /congelar/i }),
  );
  await userEvent.click(
    await within(drawer).findByRole('button', { name: /reactivar/i }),
  );

  expect(
    await screen.findByText(/maría puede volver a gastar/i),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(drawer).getByRole('button', { name: /congelar/i }),
    ).toBeInTheDocument(),
  );
});

test('at a glance the titular sees what is left and who spent it', async () => {
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  const resumen = await screen.findByRole('region', { name: /tu mandato/i });
  expect(within(resumen).getByText('$212,50')).toBeInTheDocument();
  const reparto = within(resumen).getByRole('list');
  expect(within(reparto).getByText('María')).toBeInTheDocument();
  expect(within(reparto).getByText('$62')).toBeInTheDocument();
});

test('revoking María takes three taps and the rest keeps working', async () => {
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  // 1. Su fila
  await userEvent.click(
    within(await delegados()).getByRole('button', {
      name: /^maría: ver detalle$/i,
    }),
  );
  const drawer = await screen.findByRole('dialog', { name: /maría/i });
  // 2. Revocar
  await userEvent.click(
    within(drawer).getByRole('button', { name: /^revocar$/i }),
  );
  // 3. Confirmar
  const confirm = await screen.findByRole('dialog', {
    name: /revocar a maría/i,
  });
  expect(within(confirm).getByText('Doña Rosa')).toBeInTheDocument();
  await userEvent.click(
    within(confirm).getByRole('button', { name: /revocar rama/i }),
  );

  expect(await screen.findByText(/rama maría revocada/i)).toBeInTheDocument();
  expect(db.tree.children.find((c) => c.id === 'mnd_maria')?.revoked).toBe(
    true,
  );
  expect(db.tree.children.find((c) => c.id === 'mnd_rosa')?.revoked).toBe(
    false,
  );
  // Revocada, sale de la lista de delegados (su historia queda en la libreta).
  await waitFor(() =>
    expect(
      within(lista()).queryByRole('button', {
        name: /^maría: ver detalle$/i,
        hidden: true,
      }),
    ).not.toBeInTheDocument(),
  );
  expect(
    within(lista()).getByRole('button', {
      name: /^doña rosa: ver detalle$/i,
      hidden: true,
    }),
  ).toBeInTheDocument();
});

test('from a delegate the titular opens their whole history', async () => {
  setupFlow(paths.cuenta.getHref(), { signedIn: true });

  await userEvent.click(
    within(await delegados()).getByRole('button', {
      name: /^maría: ver detalle$/i,
    }),
  );
  const drawer = await screen.findByRole('dialog', { name: /maría/i });
  await userEvent.click(
    within(drawer).getByRole('button', { name: /ver todo su historial/i }),
  );

  expect(
    await within(drawer).findByRole('heading', { name: /historial de maría/i }),
  ).toBeInTheDocument();
  // Lo de su celular (cuelga de su rama) sí; lo de otra rama, no.
  expect(
    await within(drawer).findByText(/vale firmado sin señal/i),
  ).toBeInTheDocument();
  expect(
    within(drawer).queryByText(/doña rosa pidió/i),
  ).not.toBeInTheDocument();

  await userEvent.click(
    within(drawer).getByRole('button', { name: /volver/i }),
  );
  expect(
    within(drawer).getByRole('button', { name: /ver todo su historial/i }),
  ).toBeInTheDocument();
});
