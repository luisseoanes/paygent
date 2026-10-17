import { rtlRender, screen } from '@/testing/test-utils';
import { type FeedEvent } from '@/types/api';

import { Libreta } from '../libreta';

const guardian: FeedEvent = {
  id: 'evt_g',
  at: new Date().toISOString(),
  mandateId: 'maria-device',
  actor: { type: 'agent', name: 'Agente Guardián' },
  kind: 'guardian',
  reason: 'Rechazó un vale repetido (mismo contador).',
};

test('shows what the Guardian did and why without opening anything', () => {
  rtlRender(<Libreta events={[guardian]} />);

  expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
  expect(screen.getByText('Agente Guardián intervino')).toBeInTheDocument();
  expect(screen.getByText(/rechazó un vale repetido/i)).toBeInTheDocument();
});

test('the titular sees that Puntored credited the shopkeeper without a wallet', () => {
  rtlRender(
    <Libreta
      events={[
        {
          id: 'evt_p',
          at: new Date().toISOString(),
          mandateId: 'asistente',
          actor: { type: 'agent', name: 'Puntored' },
          kind: 'payout',
          merchant: 'Tienda Doña Rosa',
          reason: 'Puntored le acreditó $12.000 a Tienda Doña Rosa en su llave Bre-B 310•••0101 (ref. BRB-9F2C11AB04)',
        },
      ]}
    />,
  );
  expect(screen.getByText('Puntored le acreditó a Tienda Doña Rosa')).toBeInTheDocument();
});
