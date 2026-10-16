import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Lee el .env de la raíz (el mismo de api y agents).
const env = loadEnv('development', '../..', '')

// /api → apps/api y /agents → agents. Así el celular solo necesita UNA url (la del túnel).
const proxy = {
  '/api': { target: env.API_URL || 'http://localhost:3001', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/api/, '') },
  '/agents': { target: env.AGENTS_URL || 'http://localhost:8000', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/agents/, '') },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // OFF-07: service worker para que /maria y /tendero abran en modo avión.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Paygent',
        short_name: 'Paygent',
        description: 'Poder de pago delegable, incluso sin internet',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/agents/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: { host: true, port: 5173, proxy, allowedHosts: true },
  preview: { host: true, port: 4173, proxy, allowedHosts: true },
})
