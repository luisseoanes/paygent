import { renderApp, screen } from '@/testing/test-utils';

import LandingRoute from '../landing';

test('renders the hero and every section of the landing', async () => {
  await renderApp(<LandingRoute />);

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: /pagar no debería necesitar internet/i,
    }),
  ).toBeInTheDocument();
  // El hero lleva a Juan; el footer no tiene botones, solo enlaces.
  expect(
    screen.getAllByRole('link', { name: /entrar a mi mandato/i }),
  ).toHaveLength(1);
  expect(
    screen.getByRole('heading', {
      level: 2,
      name: /controla cada peso que gasta tu agente/i,
    }),
  ).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
  // Qué es, problema, cómo funciona, sin señal y agentes.
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
});
