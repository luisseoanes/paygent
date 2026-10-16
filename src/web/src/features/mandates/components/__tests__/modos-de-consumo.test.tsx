import {
  fireEvent,
  renderApp,
  screen,
  userEvent,
  within,
} from '@/testing/test-utils';

import { ModosDeConsumo } from '../modos-de-consumo';

const abrir = async () => {
  // Repartir topes lo decide el titular: va con su cuenta en x-user-id.
  sessionStorage.setItem('paygent-session', 'juan');
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

  // El techo sin señal nunca supera el tope del celular.
  const techo = within(modal).getByRole('slider', { name: /techo sin señal/i });
  fireEvent.change(celular, { target: { value: '1000' } });
  expect(techo).toHaveValue('1000');

  await userEvent.click(
    within(modal).getByRole('button', { name: /guardar reparto/i }),
  );
  expect(await screen.findByText('Reparto guardado')).toBeInTheDocument();
});
