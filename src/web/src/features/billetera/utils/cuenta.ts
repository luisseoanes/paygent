import { type User } from '@/types/api';

import { type Dispositivo } from '../stores/dispositivo-store';

// El celular guardado en este navegador es de la cuenta si enlaza una de sus
// ramas. Sin ramas conocidas (sesión guardada antes de mandateIds) no se descarta.
export const esDeLaCuenta = (
  d: Pick<Dispositivo, 'mandateId'>,
  user?: Pick<User, 'mandateId' | 'mandateIds'> | null,
) => {
  const propias = user?.mandateIds ?? (user?.mandateId ? [user.mandateId] : []);
  return propias.length === 0 || propias.includes(d.mandateId);
};
