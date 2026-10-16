import { type User } from '@/types/api';

import { env } from './env';

// Juan, el único usuario de la demo. apps/api no tiene cuentas: la sesión es
// una puerta de demostración en el navegador y el mandato raíz de la semilla
// del gateway siempre se llama "root" (GW-01).
export const demoUser: User = {
  id: 'juan',
  name: 'Juan Pérez',
  email: 'juan@paygent.dev',
  walletAddress: env.JUAN_WALLET_ADDRESS,
  rootMandateId: 'root',
};
