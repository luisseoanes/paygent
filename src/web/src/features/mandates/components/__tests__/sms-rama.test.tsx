import { db } from '@/testing/mocks/db';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { SmsRama } from '../sms-rama';

const abrir = async () => {
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({
      id: 'juan',
      role: 'titular',
      rootMandateId: 'root',
      token: 'mock.juan',
    }),
  );
  await renderApp(<SmsRama mandateId="mnd_rosa" nombre="Doña Rosa" />);
  return screen.findByRole('region', { name: /sms/i });
};

test('el titular activa el SMS: número y PIN confirmado; luego ve el número enmascarado', async () => {
  const user = userEvent.setup();
  const seccion = await abrir();

  await user.click(
    await within(seccion).findByRole('button', { name: /activar sms/i }),
  );
  await user.type(within(seccion).getByLabelText(/celular/i), '300 555 1122');
  await user.type(within(seccion).getByLabelText(/^pin$/i), '2580');
  await user.type(within(seccion).getByLabelText(/confirma/i), '2581');
  await user.click(within(seccion).getByRole('button', { name: /^activar$/i }));
  expect(
    await within(seccion).findByText(/los pin no coinciden/i),
  ).toBeInTheDocument();

  await user.clear(within(seccion).getByLabelText(/confirma/i));
  await user.type(within(seccion).getByLabelText(/confirma/i), '2580');
  await user.click(within(seccion).getByRole('button', { name: /^activar$/i }));

  expect(
    await within(seccion).findByText('+57 ••• ••• 1122'),
  ).toBeInTheDocument();
  expect(seccion).not.toHaveTextContent('2580');
  expect(db.sms.mnd_rosa).toBe('+573005551122');
});

test('un PIN obvio lo rechaza la api y el SMS sigue apagado', async () => {
  const user = userEvent.setup();
  const seccion = await abrir();

  await user.click(
    await within(seccion).findByRole('button', { name: /activar sms/i }),
  );
  await user.type(within(seccion).getByLabelText(/celular/i), '3005551122');
  await user.type(within(seccion).getByLabelText(/^pin$/i), '1234');
  await user.type(within(seccion).getByLabelText(/confirma/i), '1234');
  await user.click(within(seccion).getByRole('button', { name: /^activar$/i }));

  expect(await screen.findByText(/muy fácil de adivinar/i)).toBeInTheDocument();
  expect(db.sms.mnd_rosa).toBeUndefined();
});

test('con el SMS activo, el titular lo apaga', async () => {
  db.sms.mnd_rosa = '+573005551122';
  const user = userEvent.setup();
  const seccion = await abrir();

  expect(
    await within(seccion).findByText('+57 ••• ••• 1122'),
  ).toBeInTheDocument();
  await user.click(
    within(seccion).getByRole('button', { name: /apagar sms/i }),
  );

  expect(
    await within(seccion).findByRole('button', { name: /activar sms/i }),
  ).toBeInTheDocument();
  expect(db.sms.mnd_rosa).toBeUndefined();
});
