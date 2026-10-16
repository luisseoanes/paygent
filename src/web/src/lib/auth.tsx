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
import {
  DEMO_PASSWORD,
  demoUsers,
  homeHref,
  rolLabel,
} from '@/config/demo-users';
import { paths } from '@/config/paths';
import { type Rol, type User } from '@/types/api';

// Cuentas y sesión de demostración. src/api no maneja cuentas: las cuentas
// de demo (config/demo-users.ts) y las que se registran viven en este
// navegador (localStorage, con la contraseña en hash SHA-256, nunca en
// claro), y la sesión en sessionStorage. Lo que sí es real es el mandato, el
// celular y los cobros, que viven en el gateway.

const SESSION_KEY = 'paygent-session';
const CUENTAS_KEY = 'paygent-cuentas';

type CuentaGuardada = { user: User; hash: string };

const leerCuentas = (): CuentaGuardada[] => {
  try {
    return JSON.parse(localStorage.getItem(CUENTAS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const guardarCuentas = (cuentas: CuentaGuardada[]) => {
  try {
    localStorage.setItem(CUENTAS_KEY, JSON.stringify(cuentas));
  } catch {
    // sin almacenamiento: la cuenta dura lo que dure la pestaña
  }
};

const todasLasCuentas = (): User[] => [
  ...demoUsers,
  ...leerCuentas().map((c) => c.user),
];

const hashDe = async (email: string, password: string) => {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${email}:${password}`),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
};

const readSession = () => {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    return todasLasCuentas().find((u) => u.id === id) ?? null;
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
  const correo = email.trim().toLowerCase();
  const demo = demoUsers.find((u) => u.email === correo);
  if (demo && password === DEMO_PASSWORD) {
    writeSession(demo.id);
    return demo;
  }
  const cuenta = leerCuentas().find((c) => c.user.email === correo);
  if (!cuenta || cuenta.hash !== (await hashDe(correo, password)))
    throw new Error('Correo o contraseña incorrectos.');
  writeSession(cuenta.user.id);
  return cuenta.user;
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

const crearCuenta = async (
  datos: Omit<User, 'id'>,
  password: string,
): Promise<User> => {
  const email = datos.email.trim().toLowerCase();
  const existentes = todasLasCuentas();
  if (existentes.some((u) => u.email === email))
    throw new Error('Ya hay una cuenta con ese correo. Inicia sesión.');
  if (
    datos.documento &&
    existentes.some((u) => u.documento === datos.documento)
  )
    throw new Error('Ya hay una cuenta con ese documento.');
  const user: User = { ...datos, email, id: `u_${crypto.randomUUID()}` };
  guardarCuentas([
    ...leerCuentas(),
    { user, hash: await hashDe(email, password) },
  ]);
  writeSession(user.id);
  return user;
};

const registrarTitular = ({ password, ...d }: RegistroTitular) =>
  crearCuenta(
    {
      ...d,
      name: d.nombre,
      role: 'titular',
      // La semilla del gateway tiene un solo mandato raíz (GW-01)
      rootMandateId: 'root',
    },
    password,
  );

const registrarBeneficiario = ({
  password,
  mandateId,
  ...d
}: RegistroBeneficiario & { mandateId: string }) =>
  crearCuenta(
    {
      ...d,
      name: d.nombre,
      role: 'beneficiario',
      rootMandateId: null,
      mandateId,
    },
    password,
  );

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

// Cerrar sesión desde una pantalla protegida: primero se sale de ella y la
// sesión se cierra al llegar (useCierrePendiente, en el layout de destino).
// Si se cerrara antes, ProtectedRoute mandaría a iniciar sesión.
let cierrePendiente = false;
export const pedirCierreDeSesion = () => {
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
