/// <reference types="vitest/config" />
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// .env de la raíz del monorepo (el mismo de api y agents).
const rootEnv = loadEnv('development', '../..', '');

// /api → src/api y /agents → src/agents: con un túnel, el celular solo
// necesita UNA url (VITE_APP_API_URL=/api).
const proxy = {
  '/api': {
    target: rootEnv.API_URL || 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ''),
  },
  '/agents': {
    target: rootEnv.AGENTS_URL || 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/agents/, ''),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 5173 es el WEB_URL al que src/api redirige tras firmar el mandato.
  server: { host: true, port: 5173, proxy, allowedHosts: true },
  preview: { host: true, port: 4173, proxy, allowedHosts: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup-tests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    env: {
      VITE_APP_API_URL: 'http://localhost:3000/api',
      VITE_APP_ENABLE_API_MOCKING: 'false',
    },
  },
});
