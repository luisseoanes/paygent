import { usd } from '@/features/mandates/utils/mandate';
import { renderApp, screen, within } from '@/testing/test-utils';
import { type MandateTree } from '@/types/api';

import { Delegados } from '../delegados';

const rama = (
  id: string,
  max: number,
  extra: Partial<MandateTree> = {},
): MandateTree => ({
  id,
  parentId: null,
  holderType: 'person',
  holderId: id,
  holderName: id,
  maxDebit: usd(max),
  interval: 'R/2026-10-01T00:00:00Z/P1M',
  spentInPeriod: usd(0),
  categories: ['mercado'],
  canSpend: true,
  expiresAt: '2027-01-01T00:00:00Z',
  revoked: false,
  frozen: false,
  signature: '',
  children: [],
  ...extra,
});

// María tiene 1.000 y ya gastó 900 por SMS: su celular (400) no puede prometer más de 100.
const arbol = () =>
  rama('root', 1200, {
    spentInPeriod: usd(900),
    children: [
      rama('maria', 1000, {
        holderName: 'María',
        parentId: 'root',
        spentInPeriod: usd(900),
        children: [
          rama('maria-cel', 400, { holderType: 'device', mode: 'celular', parentId: 'maria' }),
          rama('maria-sms', 200, { holderType: 'agent', mode: 'sms', parentId: 'maria', spentInPeriod: usd(200) }),
          rama('maria-ag', 200, { holderType: 'agent', mode: 'asistente', parentId: 'maria' }),
          rama('nieta', 50, { holderName: 'Nieta', parentId: 'maria' }),
        ],
      }),
    ],
  });

test('los modos de una persona se ven como un reparto de su tope, no como ramas con dinero aparte', async () => {
  await renderApp(<Delegados root={arbol()} onOpen={() => {}} />);

  const modos = await screen.findByRole('list', { name: 'Formas de pagar de María' });
  const chips = within(modos).getAllByRole('button');
  // En orden celular, Asistente, SMS; cada uno con lo que de verdad le queda.
  expect(chips.map((c) => c.textContent)).toEqual(['Celular$100', 'Asistente$100', 'SMS$0']);
  // Otra persona que cuelga de María sigue siendo una fila propia.
  expect(screen.getByRole('button', { name: 'Nieta: ver detalle' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'maria-cel: ver detalle' })).not.toBeInTheDocument();
});
