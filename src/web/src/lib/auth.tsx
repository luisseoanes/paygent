import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as React from 'react';
import { Navigate, useLocation } from 'react-router';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { demoUsers, homeHref, rolLabel } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { api } from '@/lib/api-client';
import { type Rol, type User } from '@/types/api';

// Cuentas en src/api (Postgres): POST /auth/login y /auth/register/*. La api devuelve la cuenta con su rol y su
// mandato (raíz del titular o rama del beneficiario); la sesión guarda esa cuenta en sessionStorage. La api todavía
// no emite token: la sesión es la cuenta que devolvió el login.

const SESSION_KEY = 'paygent-session';

const readSession = (): User | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (raw.startsWith('{')) return JSON.parse(raw) as User;
    // Sesión de la versión anterior (solo el id de una cuenta de demo).
    return demoUsers.find((u) => u.id === raw) ?? null;
  } catch {
    return null;
  }
};

const writeSession = (user: User | null) => {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar
  }
};

const getUser = async (): Promise<User | null> => readSession();

/** Raíz del titular con sesión: la api atiende a cada titular por su raíz (grant, estado y feed). */
export const currentRootMandateId = () => readSession()?.rootMandateId ?? null;

/** Cuenta con sesión: la api la pide en x-user-id para lo que solo decide el titular. */
export const currentUserId = () => readSession()?.id ?? null;

export const getUserQueryOptions = () =>
  queryOptions({ queryKey: ['auth-user'], queryFn: getUser });

export const useUser = () => useQuery(getUserQueryOptions());

export const loginInputSchema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/** El mensaje de la api ({ error }) o uno por defecto. */
const motivo = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
  fallback;

const entrar = (user: User) => {
  writeSession(user);
  return user;
};

const login = async ({ email, password }: LoginInput): Promise<User> => {
  try {
    return entrar(
      await api.post<unknown, User>('/auth/login', {
        email: email.trim(),
        password,
      }),
    );
  } catch (err) {
    throw new Error(motivo(err, 'Correo o contraseña incorrectos.'));
  }
};

// --- Registro ----------------------------------------------------------------

const nombre = z.string().trim().min(2, 'Escribe tu nombre');
const documento = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, 'Solo números, entre 6 y 12');
const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^\+?\d{10,13}$/.test(v), 'Escribe un celular válido');
const clave = z.string().min(8, 'Mínimo 8 caracteres');

// "$ilp.interledger-test.dev/juan" → "https://ilp.interledger-test.dev/juan"
const wallet = z
  .string()
  .trim()
  .transform((v) => (v.startsWith('$') ? `https://${v.slice(1)}` : v))
  .refine(
    (v) => /^https:\/\/[^\s/]+\.[^\s/]+\/\S+$/.test(v),
    'Escribe tu wallet address (ej. $ilp.interledger-test.dev/tu-nombre)',
  );

export const registroTitularSchema = z.object({
  documento,
  nombre,
  apellido: z.string().trim().min(2, 'Escribe tu apellido'),
  email: z.email('Escribe un correo válido'),
  telefono,
  password: clave,
  walletAddress: wallet,
});

export const registroBeneficiarioSchema = z.object({
  nombre,
  documento,
  email: z.email('Escribe un correo válido'),
  telefono,
  password: clave,
});

export type RegistroTitular = z.output<typeof registroTitularSchema>;
export type RegistroBeneficiario = z.output<typeof registroBeneficiarioSchema>;

const registrar = async (url: string, datos: object): Promise<User> => {
  try {
    return entrar(await api.post<unknown, User>(url, datos));
  } catch (err) {
    throw new Error(motivo(err, 'No se pudo crear la cuenta.'));
  }
};

// Cada titular queda con SU mandato raíz (lo crea la api); firma el grant en su billetera desde su panel.
const registrarTitular = (d: RegistroTitular) =>
  registrar('/auth/register/titular', d);

// El beneficiario queda enlazado a la rama que le dio su titular (el código).
const registrarBeneficiario = (
  d: RegistroBeneficiario & { mandateId: string },
) => registrar('/auth/register/beneficiario', d);

const useSesionNueva = <T,>(
  mutationFn: (datos: T) => Promise<User>,
  onSuccess?: (user: User) => void,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(getUserQueryOptions().queryKey, user);
      onSuccess?.(user);
    },
  });
};

export const useRegistrarTitular = ({
  onSuccess,
}: { onSuccess?: (user: User) => void } = {}) =>
  useSesionNueva(registrarTitular, onSuccess);

export const useRegistrarBeneficiario = ({
  onSuccess,
}: { onSuccess?: (user: User) => void } = {}) =>
  useSesionNueva(registrarBeneficiario, onSuccess);

const logout = async () => writeSession(null);

// Cerrar sesión desde una pantalla protegida: la sesión guardada se borra ya
// (sobrevive a una recarga por versión nueva) y la de memoria al llegar
// (useCierrePendiente); si se borrara antes, ProtectedRoute mandaría al login.
let cierrePendiente = false;
export const pedirCierreDeSesion = () => {
  writeSession(null);
  cierrePendiente = true;
};

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

export const useCierrePendiente = () => {
  const location = useLocation();
  const logout = useLogout();
  const { mutate } = logout;
  React.useEffect(() => {
    if (!cierrePendiente) return;
    cierrePendiente = false;
    mutate();
  }, [location.key, mutate]);
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
          title={`Esta vista es para una cuenta de ${rolLabel[rol].nombre}`}
          description={`Entraste con una cuenta de ${rolLabel[user.data.role].nombre}. Ve a tu app o cambia de cuenta.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link variant="unstyled" to={homeHref(user.data.role)}>
                  {rolLabel[user.data.role].app}
                </Link>
              </Button>
              <Button
                variant="outline"
                isLoading={logout.isPending}
                onClick={() => logout.mutate()}
              >
                Cambiar de cuenta
              </Button>
            </div>
          }
          className="max-w-md rounded-3xl"
        />
      </div>
    );

  return children;
};
