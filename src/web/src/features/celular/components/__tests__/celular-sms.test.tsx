import { renderApp, screen, userEvent } from '@/testing/test-utils';

import { CelularSms } from '../celular-sms';

test('pide la medicina, confirma con el PIN sin mostrarlo y recibe el código de retiro', async () => {
  await renderApp(<CelularSms telefono="+573001112233" />);
  const user = userEvent.setup();

  await user.type(
    screen.getByRole('textbox', { name: 'Mensaje' }),
    'necesito la pastilla de la presión',
  );
  await user.click(screen.getByRole('button', { name: /^enviar$/i }));
  expect(await screen.findByText(/responda con su pin/i)).toBeInTheDocument();

  for (const k of ['1', '2', '3', '4'])
    await user.click(screen.getByRole('button', { name: k }));
  await user.click(screen.getByRole('button', { name: /^enviar$/i }));

  expect(await screen.findByText(/código 8899/i)).toBeInTheDocument();
  const log = screen.getByRole('log');
  expect(log).toHaveTextContent('••••');
  expect(log).not.toHaveTextContent('1234');
});
