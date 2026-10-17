import {
  fireEvent,
  renderApp,
  screen,
  userEvent,
  within,
} from '@/testing/test-utils';

import { ModosDeConsumo } from '../modos-de-consumo';

const abrir = async () => {
  // Repartir topes lo decide el titular: va con su token de sesión.
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({
      id: 'juan',
      role: 'titular',
      rootMandateId: 'root',
      token: 'mock.juan',
    }),
  );
  await renderApp(<ModosDeConsumo personaId="mnd_maria" />);
};

test('the titular sees how each mode is used and can enable the missing ones', async () => {
  await abrir();

  expect(await screen.findByText('Celular (vale QR)')).toBeInTheDocument();
  expect(screen.getByText(/muestra el QR/i)).toBeInTheDocument();
  expect(
    screen.getByRole('button', {
      name: /habilitar asistente en la app, sms/i,
    }),
  ).toBeInTheDocument();
});

test('the sliders move the caps, update what is left in real time and stop where the budget ends', async () => {
  await abrir();
  await userEvent.click(
    await screen.findByRole('button', { name: /ajustar topes/i }),
  );
  const modal = await screen.findByRole('dialog', {
    name: /repartir el tope/i,
  });

  // María: $150; su celular tiene $40 → quedan $110 libres.
  const libre = within(modal).getByText('Libre para asignar').nextSibling!;
  expect(libre).toHaveTextContent('$110');

  const celular = within(modal).getByRole('slider', {
    name: /tope de celular/i,
  });
  fireEvent.change(celular, { target: { value: '9000' } });
  expect(libre).toHaveTextContent('$60');

  // Más de lo que hay: se detiene donde se acaba lo libre.
  fireEvent.change(celular, { target: { value: '99999' } });
  expect(libre).toHaveTextContent('$0');
  expect(celular).toHaveValue('15000');

  // El techo sin señal nunca supera el tope del celular, y junto a él se ve lo
  // que el celular puede gastar hoy (lo mueve el Guardián).
  const techo = within(modal).getByRole('slider', { name: /techo sin señal/i });
  expect(within(modal).getByText(/hoy puede gastar/i)).toBeInTheDocument();
  fireEvent.change(celular, { target: { value: '1000' } });
  expect(techo).toHaveValue('1000');

  await userEvent.click(
    within(modal).getByRole('button', { name: /guardar reparto/i }),
  );
  expect(await screen.findByText('Reparto guardado')).toBeInTheDocument();
});

test('the total cap rises with what the mandate has left and, when lowered, the modes shrink in proportion', async () => {
  await abrir();
  await userEvent.click(
    await screen.findByRole('button', { name: /ajustar topes/i }),
  );
  const modal = await screen.findByRole('dialog', {
    name: /repartir el tope/i,
  });
  const libre = within(modal).getByText('Libre para asignar').nextSibling!;
  const totalMaria = within(modal).getByRole('slider', {
    name: /tope total de maría/i,
  });
  const celular = within(modal).getByRole('slider', {
    name: /tope de celular/i,
  });
  const techo = within(modal).getByRole('slider', { name: /techo sin señal/i });
  expect(totalMaria).toHaveValue('15000');

  // Más de lo que deja el mandato: se detiene en el máximo y lo libre crece.
  fireEvent.change(totalMaria, { target: { value: '999999' } });
  const maximo = Number((totalMaria as HTMLInputElement).value);
  expect(maximo).toBeGreaterThan(15000);
  expect(libre).toHaveTextContent(`$${(maximo - 4000) / 100}`);

  // Por debajo de lo repartido: el celular baja en proporción y su techo con él.
  fireEvent.change(totalMaria, { target: { value: '1000' } });
  expect(celular).toHaveValue('1000');
  expect(techo).toHaveValue('1000');
  expect(libre).toHaveTextContent('$0');

  await userEvent.click(
    within(modal).getByRole('button', { name: /guardar reparto/i }),
  );
  expect(await screen.findByText('Reparto guardado')).toBeInTheDocument();
});
