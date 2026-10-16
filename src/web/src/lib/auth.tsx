import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import * as z from 'zod';

import { Spinner } from '@/components/ui/spinner';
import { demoUser } from '@/config/demo-user';
import { paths } from '@/config/paths';
import { type User } from '@/types/api';

// Sesión de demostración. apps/api no maneja cuentas: entrar es una puerta en
// el navegador (sessionStorage) y el usuario siempre es Juan. Lo que sí es
// real es su mandato, que vive en el gateway.

const SESSION_KEY = 'paygent-session';

const readSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSession = (active: boolean) => {
  try {
    if (active) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar
  }
};

const getUser = async (): Promise<User | null> =>
  readSession() ? demoUser : null;

export const getUserQueryOptions = () =>
  queryOptions({ queryKey: ['auth-user'], queryFn: getUser });

export const useUser = () => useQuery(getUserQueryOptions());

export const loginInputSchema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// El formulario ya validó correo y contraseña; no hay cuenta que verificar.
const login = async (_data: LoginInput): Promise<User> => {
  writeSession(true);
  return demoUser;
};

const logout = async () => writeSession(false);

export const useLogin = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(getUserQueryOptions().queryKey, user);
      onSuccess?.();
    },
  });
};

export const useLogout = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(getUserQueryOptions().queryKey, null);
      queryClient.removeQueries({ queryKey: ['mandates'] });
      onSuccess?.();
    },
  });
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useUser();
  const location = useLocation();

  if (user.isPending)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  if (!user.data) {
    return (
      <Navigate
        to={paths.auth.login.getHref(location.pathname + location.search)}
        replace
      />
    );
  }

  return children;
};
