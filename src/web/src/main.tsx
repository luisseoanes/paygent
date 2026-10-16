import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/globals.css';
import { App } from './app';
import { env } from './config/env';
import { enableMocking } from './testing/mocks';

const root = document.getElementById('root');
if (!root) throw new Error('No root element found');

// OFF-07: con la API real, el service worker deja abrir la app sin señal.
// Con MSW no se registra: los dos service workers pelearían por el scope.
const registrarPwa = async () => {
  if (!import.meta.env.PROD || env.ENABLE_API_MOCKING) return;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
};

enableMocking().then(() => {
  registrarPwa();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
