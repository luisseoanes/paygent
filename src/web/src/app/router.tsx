import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { RouteError } from '@/components/errors';
import { Spinner } from '@/components/ui/spinner';
import { paths } from '@/config/paths';

import AppRoot from './routes/root';

// Converts a lazily imported route module into a route object.
// A route module exports:
//   - default: the page component (required)
//   - clientLoader?: (queryClient) => loader   (prefetch data before render)
//   - clientAction?: (queryClient) => action
//   - ErrorBoundary?: route-level error UI
const convert = (queryClient: QueryClient) => (m: any) => {
  const { clientLoader, clientAction, default: Component, ...rest } = m;
  return {
    ...rest,
    loader: clientLoader?.(queryClient),
    action: clientAction?.(queryClient),
    Component,
  };
};

export const createAppRouter = (queryClient: QueryClient) =>
  createBrowserRouter([
    {
      // Root layout (header + footer). Every page is a child route.
      element: <AppRoot />,
      errorElement: <RouteError />,
      // Shown while the first route's clientLoader runs on initial load.
      HydrateFallback: () => (
        <div className="flex h-dvh w-full items-center justify-center">
          <Spinner size="xl" />
        </div>
      ),
      children: [
        {
          path: paths.home.path,
          lazy: () => import('./routes/landing').then(convert(queryClient)),
        },
        {
          path: paths.auth.login.path,
          lazy: () => import('./routes/auth/login').then(convert(queryClient)),
        },
        {
          path: paths.juan.path,
          lazy: () => import('./routes/juan').then(convert(queryClient)),
        },
        // ROUTES:INSERT — keep this marker, new routes go above it.
        {
          path: '*',
          lazy: () => import('./routes/not-found').then(convert(queryClient)),
        },
      ],
    },
  ]);

export const AppRouter = () => {
  const queryClient = useQueryClient();

  const router = useMemo(() => createAppRouter(queryClient), [queryClient]);

  return <RouterProvider router={router} />;
};
