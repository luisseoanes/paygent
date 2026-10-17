import { demoUsers } from '@/config/demo-users';
import { type User } from '@/types/api';

// La sesión es la cuenta que devolvió el login, con su token firmado por la api. Vive en sessionStorage (por pestaña).

const SESSION_KEY = 'paygent-session';

export const readSession = (): User | null => {
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

export const writeSession = (user: User | null) => {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar
  }
};

/** Token de la sesión: va en Authorization (y en ?token= en el SSE, que no admite cabeceras). */
export const currentToken = () => readSession()?.token ?? null;
