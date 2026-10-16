/// <reference types="vitest/config" />
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
  plugins: [
    react(),
    tailwindcss(),
    // OFF-07: service worker para que /maria y /tendero abran en modo avión.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Paygent',
        short_name: 'Paygent',
        description: 'Paga con un permiso delegado, incluso sin señal.',
        lang: 'es-CO',
        theme_color: '#1f3fae',
        background_color: '#f3f2ee',
        display: 'standalone',
        start_url: '/maria',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/agents/, /mockServiceWorker/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 5173 es el WEB_URL al que src/api redirige tras firmar el mandato.
  server: { host: true, port: 5173, proxy, allowedHosts: true },
  // Producción (Railway) sirve el build con `vite preview` en el PORT de la plataforma.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
    proxy,
    allowedHosts: true,
  },
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
