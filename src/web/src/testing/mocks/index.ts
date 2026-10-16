import { env } from '@/config/env';

// Starts the MSW service worker in the browser when VITE_APP_ENABLE_API_MOCKING=true,
// so the frontend can be built before (or without) the real backend.
export const enableMocking = async () => {
  if (!env.ENABLE_API_MOCKING) return;

  const { worker } = await import('./browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
};
