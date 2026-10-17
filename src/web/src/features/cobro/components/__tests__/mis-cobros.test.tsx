import { mockMerchants } from '@/testing/mocks/handlers/offline';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { MisCobros } from '../mis-cobros';

// La tienda sin wallet cobra por Puntored: ve a qué llave le llega y lo que ya le acreditaron (o no).
const tienda = () => ({ ...mockMerchants[0]! });

test('shows how the store gets paid and what Puntored credited to its Bre-B key', async () => {
  await renderApp(<MisCobros merchant={tienda()} />);

  expect(
    screen.getByText('Por Puntored a tu llave Bre-B 310•••0101'),
  ).toBeInTheDocument();
  expect(
    await screen.findByText('Acreditado en tu llave 310•••0101'),
  ).toBeInTheDocument();
  expect(screen.getByText(/BRB-9F2C11AB04/)).toBeInTheDocument();
  // Lo que no se pudo acreditar no se pierde: queda para retirar en su punto.
  expect(
    screen.getByText('Para retirar en tu punto Puntored'),
  ).toBeInTheDocument();
  expect(screen.getByText(/simulada en esta demo/i)).toBeInTheDocument();
});

test('the shopkeeper can switch to receiving in their own wallet', async () => {
  await renderApp(<MisCobros merchant={tienda()} />);

  await userEvent.click(screen.getByRole('button', { name: /cambiar/i }));
  await userEvent.selectOptions(
    screen.getByLabelText(/cómo quieres recibir/i),
    'wallet',
  );
  await userEvent.type(
    screen.getByLabelText(/wallet address/i),
    '$ilp.interledger-test.dev/dona-rosa',
  );
  await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

  const seccion = screen.getByRole('region', { name: /cómo cobras/i });
  expect(
    await within(seccion).findByText('Directo a tu wallet de Open Payments'),
  ).toBeInTheDocument();
});
