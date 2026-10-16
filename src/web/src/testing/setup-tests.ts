import '@testing-library/jest-dom/vitest';

import { resetDb } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

// Resets every zustand store between tests (see __mocks__/zustand.ts).
vi.mock('zustand');

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetDb();
  globalThis.sessionStorage?.clear();
  globalThis.localStorage?.clear();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  // motion `whileInView` necesita IntersectionObserver (jsdom no lo trae).
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    })),
  );
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
});
