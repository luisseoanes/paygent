import Axios, { type InternalAxiosRequestConfig } from 'axios';

import { useNotifications } from '@/components/ui/notifications';
import { env } from '@/config/env';

// Single, preconfigured API client for the whole application.
// The response interceptor unwraps `response.data`, so request functions
// return the payload directly.

function requestInterceptor(config: InternalAxiosRequestConfig) {
  config.headers.Accept = 'application/json';
  return config;
}

export const api = Axios.create({
  baseURL: env.API_URL,
});

api.interceptors.request.use(requestInterceptor);
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Sin sesión no es un error que mostrar: lo resuelve ProtectedRoute.
    if (error.response?.status === 401) return Promise.reject(error);

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
