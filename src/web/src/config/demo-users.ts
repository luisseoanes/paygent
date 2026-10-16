import { type Rol, type User } from '@/types/api';

import { env } from './env';
import { paths } from './paths';

// Cuentas de la demo (ver CUENTAS-DEMO.md). La API no maneja cuentas: la
// sesión es una puerta de demostración en el navegador. Lo real es el
// mandato de Juan, el celular de María y los cobros del tendero.

export const DEMO_PASSWORD = 'paygent123';

export const demoUsers: User[] = [
  {
    id: 'juan',
    role: 'juan',
    name: 'Juan Pérez',
    email: 'juan@paygent.dev',
    walletAddress: env.JUAN_WALLET_ADDRESS,
    // El mandato raíz de la semilla del gateway siempre se llama "root" (GW-01)
    rootMandateId: 'root',
  },
  {
    id: 'maria',
    role: 'maria',
    name: 'María Pérez',
    email: 'maria@paygent.dev',
    rootMandateId: null,
  },
  {
    id: 'tendero',
    role: 'tendero',
    name: 'Rosa Gómez',
    email: 'tendero@paygent.dev',
    rootMandateId: null,
  },
];

export const rolLabel: Record<Rol, { nombre: string; app: string }> = {
  juan: { nombre: 'Juan', app: 'Mi mandato' },
  maria: { nombre: 'María', app: 'Mi billetera' },
  tendero: { nombre: 'Tendero', app: 'Mi caja' },
};

// A dónde va cada rol al entrar.
export const homeHref = (role: Rol) =>
  role === 'maria'
    ? paths.maria.getHref()
    : role === 'tendero'
      ? paths.tendero.getHref()
      : paths.juan.getHref();
