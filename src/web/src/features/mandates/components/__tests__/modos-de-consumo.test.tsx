import { renderApp, screen, userEvent } from '@/testing/test-utils';

import { ModosDeConsumo } from '../modos-de-consumo';

test('the titular sees how each mode is used, changes its cap and can enable the missing ones', async () => {
  // Cambiar topes lo decide el titular: va con su cuenta en x-user-id.
  sessionStorage.setItem('paygent-session', 'juan');
  await renderApp(<ModosDeConsumo personaId="mnd_maria" />);

  expect(await screen.findByText('Celular (vale QR)')).toBeInTheDocument();
  expect(screen.getByText(/muestra el QR/i)).toBeInTheDocument();
  expect(
    screen.getByRole('button', {
      name: /habilitar asistente en la app, sms/i,
    }),
  ).toBeInTheDocument();

  const tope = screen.getByRole('textbox', { name: /tope de celular/i });
  await userEvent.clear(tope);
  await userEvent.type(tope, '30');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByText('Tope actualizado')).toBeInTheDocument();
});
