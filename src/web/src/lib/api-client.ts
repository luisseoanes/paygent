import Axios, { type InternalAxiosRequestConfig } from 'axios';

import { useNotifications } from '@/components/ui/notifications';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { currentToken, readSession, writeSession } from '@/lib/session';

// Single, preconfigured API client for the whole application.
// The response interceptor unwraps `response.data`, so request functions
// return the payload directly.

function requestInterceptor(config: InternalAxiosRequestConfig) {
  config.headers.Accept = 'application/json';
  const token = currentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

// Con sesión guardada, un 401 es que venció (o es de antes de los tokens): se cierra y se vuelve al login.
const sesionVencida = (url?: string) => {
  if (!readSession() || url?.startsWith('/auth/')) return;
  writeSession(null);
  const vuelta = window.location.pathname + window.location.search;
  window.location.assign(paths.auth.login.getHref(vuelta));
};

export const api = Axios.create({
  baseURL: env.API_URL,
});

api.interceptors.request.use(requestInterceptor);
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Sin sesión no es un error que mostrar: lo resuelve ProtectedRoute.
    if (error.response?.status === 401) {
      sesionVencida(error.config?.url);
      return Promise.reject(error);
    }

    // apps/api responde { error }; los mocks, { message }.
    const message: string =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Algo falló. Nada cambió.';

    useNotifications.getState().addNotification({
      type: 'error',
      title: 'No se pudo completar',
      message,
    });

    return Promise.reject(error);
  },
);
