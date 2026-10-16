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
  // Hero y cierre llevan a Juan.
  expect(
    screen.getAllByRole('link', { name: /entrar a mi mandato/i }),
  ).toHaveLength(2);
  expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(
    5,
  );
});
