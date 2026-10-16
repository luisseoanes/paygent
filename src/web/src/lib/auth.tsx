import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { DEMO_PASSWORD, demoUsers, rolLabel } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { type Rol, type User } from '@/types/api';

// Sesión de demostración. src/api no maneja cuentas: entrar es una puerta en
// el navegador (sessionStorage) con las cuentas de config/demo-users.ts. Lo
// que sí es real es el mandato, el celular y los cobros, que viven en el
// gateway.

const SESSION_KEY = 'paygent-session';

const readSession = () => {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return demoUsers.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
};

const writeSession = (userId: string | null) => {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar
  }
};

const getUser = async (): Promise<User | null> => readSession();

export const getUserQueryOptions = () =>
  queryOptions({ queryKey: ['auth-user'], queryFn: getUser });

export const useUser = () => useQuery(getUserQueryOptions());

export const loginInputSchema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

const login = async ({ email, password }: LoginInput): Promise<User> => {
  const user = demoUsers.find((u) => u.email === email.trim().toLowerCase());
  if (!user || password !== DEMO_PASSWORD)
    throw new Error('Correo o contraseña incorrectos.');
  writeSession(user.id);
  return user;
};

const logout = async () => writeSession(null);

export const useLogin = ({
  onSuccess,
}: { onSuccess?: (user: User) => void } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(getUserQueryOptions().queryKey, user);
      onSuccess?.(user);
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

// Con `rol`, solo esa cuenta entra; las demás ven a quién pertenece la vista.
export const ProtectedRoute = ({
  children,
  rol,
}: {
  children: React.ReactNode;
  rol?: Rol;
}) => {
  const user = useUser();
  const location = useLocation();
  const logout = useLogout();

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

  if (rol && user.data.role !== rol)
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <EmptyState
          title={`Esta vista es de ${rolLabel[rol].nombre}`}
          description={`Entraste como ${user.data.name}. Cierra sesión y entra con la cuenta de ${rolLabel[rol].nombre} para usarla.`}
          action={
            <Button
              isLoading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Cambiar de cuenta
            </Button>
          }
          className="max-w-md rounded-3xl"
        />
      </div>
    );

  return children;
};
