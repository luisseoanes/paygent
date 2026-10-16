import { delay } from 'msw';

import { env } from '@/config/env';

// Builds a full API url for a handler: apiUrl('/payments')
export const apiUrl = (path: string) => `${env.API_URL}${path}`;

// Simulates network latency in the browser, but not in tests.
export const networkDelay = () =>
  delay(import.meta.env.MODE === 'test' ? 0 : 300);
