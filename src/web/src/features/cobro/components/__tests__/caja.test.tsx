import { useCobroStore } from '@/features/cobro/stores/cobro-store';
import { db } from '@/testing/mocks/db';
import { mockMerchants } from '@/testing/mocks/handlers/offline';
import { renderApp, screen, within } from '@/testing/test-utils';

import { Caja } from '../caja';

// La caja muestra lo que recibió la tienda según la api, aunque los vales se
// hayan escaneado en otro celular o el pago venga del Asistente.
test('el tendero ve lo cobrado hoy y su historial aunque este celular no haya escaneado nada', async () => {
  db.feed.unshift({
    id: 'evt_caja_1',
    at: new Date().toISOString(),
    mandateId: 'asistente',
    actor: { type: 'agent', name: 'Asistente' },
    kind: 'payment',
    amount: { value: '300', assetCode: 'USD', assetScale: 2 },
    merchant: 'Tienda Doña Rosa',
    reason: 'Arroz y panela por SMS',
  });
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({
      id: 'tendero',
      role: 'tendero',
      rootMandateId: null,
      merchantId: 'tienda',
      token: 'mock.tendero',
    }),
  );
  useCobroStore.setState({
    merchants: mockMerchants,
    merchantId: 'tienda',
    fx: 4000,
    vales: [],
  });

  await renderApp(<Caja online sincronizando={false} onEscanear={() => {}} />);

  const historial = await screen.findByRole('region', {
    name: /historial de cobros/i,
  });
  const fila = (
    await within(historial).findByText(/arroz y panela por sms/i)
  ).closest('li')!;
  expect(fila).toHaveTextContent('Cobrado');
  // 3 USD a 4.000 COP/USD: el pago de hoy entra en lo cobrado hoy.
  expect(fila).toHaveTextContent(/12\.000/);
  const hoy = screen.getByRole('region', { name: /hoy recibiste/i });
  const cifra = Number(
    hoy.querySelector('.cifra')!.textContent!.replace(/\D/g, ''),
  );
  expect(cifra).toBeGreaterThanOrEqual(12_000);
});
