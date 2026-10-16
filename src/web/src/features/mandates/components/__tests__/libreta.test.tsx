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
