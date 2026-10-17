import { type Rol, type User } from '@/types/api';

import { env } from './env';
import { paths } from './paths';

// Cuentas de la demo (ver CUENTAS-DEMO.md). La API no maneja cuentas: la
// sesión es una puerta de demostración en el navegador. Lo real es el
// mandato del titular, el celular del beneficiario y los cobros del tendero.

export const DEMO_PASSWORD = 'paygent123';

export const demoUsers: User[] = [
  {
    id: 'juan',
    role: 'titular',
    name: 'Juan',
    apellido: 'Pérez',
    email: 'juan@paygent.dev',
    walletAddress: env.JUAN_WALLET_ADDRESS,
    // El mandato raíz de la semilla del gateway siempre se llama "root" (GW-01)
    rootMandateId: 'root',
  },
  {
    id: 'maria',
    role: 'beneficiario',
    name: 'María',
    apellido: 'Pérez',
    email: 'maria@paygent.dev',
    rootMandateId: null,
    mandateId: 'maria-device',
  },
  {
    id: 'tendero',
    role: 'tendero',
    name: 'Rosa',
    apellido: 'Gómez',
    email: 'tendero@paygent.dev',
    rootMandateId: null,
    merchantId: 'tienda',
  },
];

export const rolLabel: Record<Rol, { nombre: string; app: string }> = {
  titular: { nombre: 'titular', app: 'Mi cuenta' },
  beneficiario: { nombre: 'beneficiario', app: 'Mi billetera' },
  tendero: { nombre: 'tendero', app: 'Mi caja' },
};

// "María Pérez"
export const nombreCompleto = (u: Pick<User, 'name' | 'apellido'>) =>
  [u.name, u.apellido].filter(Boolean).join(' ');

// A dónde va cada tipo de cuenta al entrar.
export const homeHref = (role: Rol) =>
  role === 'beneficiario'
    ? paths.billetera.getHref()
    : role === 'tendero'
      ? paths.tendero.getHref()
      : paths.cuenta.getHref();
