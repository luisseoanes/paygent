import {
  render as rtlRender,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { AppProvider } from '@/app/provider';

export const waitForLoadingToFinish = async () => {
  const loaders = screen.queryAllByRole('status');
  if (loaders.length === 0) return;
  await waitForElementToBeRemoved(() => screen.queryAllByRole('status'), {
    timeout: 4000,
  });
};

type RenderAppOptions = {
  // Route pattern the UI is mounted on, e.g. '/payments/:paymentId'.
  path?: string;
  // Initial URL, e.g. '/payments/123'.
  url?: string;
};

// Renders a route/page with every global provider and a memory router.
// API calls are answered by the MSW handlers in testing/mocks.
export const renderApp = async (
  ui: React.ReactElement,
  { path = '/', url = '/' }: RenderAppOptions = {},
) => {
  const router = createMemoryRouter([{ path, element: ui }], {
    initialEntries: [url],
  });

  const view = rtlRender(
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>,
  );

  await waitForLoadingToFinish();

  return { ...view, router };
};

export * from '@testing-library/react';
export { userEvent, rtlRender };
