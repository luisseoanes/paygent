import { HttpResponse, http } from 'msw';

import { DEMO_PASSWORD, demoUsers } from '@/config/demo-users';
import { type User } from '@/types/api';

import { apiUrl, networkDelay } from '../utils';

// Cuentas simuladas con el mismo contrato que src/api (/auth/login y /auth/register/*). Las de demo usan
// DEMO_PASSWORD; las que se registran viven en memoria mientras dure la sesión del mock.
const registradas: { user: User; password: string }[] = [];

const buscar = (email: string) => {
  const correo = email.trim().toLowerCase();
  const demo = demoUsers.find((u) => u.email === correo);
  if (demo) return { user: demo, password: DEMO_PASSWORD };
  return registradas.find((c) => c.user.email === correo);
};

// El mock no firma nada: basta con que la web reenvíe el token en Authorization.
const conToken = (user: User): User => ({ ...user, token: `mock.${user.id}` });

const conflicto = (message: string) =>
  HttpResponse.json({ error: message }, { status: 409 });

export const authHandlers = [
  http.post(apiUrl('/auth/login'), async ({ request }) => {
    await networkDelay();
    const { email, password } = (await request.json()) as {
      email: string;
      password: string;
    };
    const cuenta = buscar(email);
    if (!cuenta || cuenta.password !== password)
      return HttpResponse.json(
        { error: 'Correo o contraseña incorrectos' },
        { status: 401 },
      );
    return HttpResponse.json(conToken(cuenta.user));
  }),

  http.post(apiUrl('/auth/register/titular'), async ({ request }) => {
    await networkDelay();
    const d = (await request.json()) as Record<string, string>;
    if (buscar(d.email!))
      return conflicto('Ya hay una cuenta con ese correo. Inicia sesión.');
    const id = `u_${crypto.randomUUID()}`;
    const user: User = {
      id,
      role: 'titular',
      name: d.nombre!,
      apellido: d.apellido,
      documento: d.documento,
      telefono: d.telefono,
      email: d.email!.toLowerCase(),
      walletAddress: d.walletAddress,
      rootMandateId: `root_${id}`,
    };
    registradas.push({ user, password: d.password! });
    return HttpResponse.json(conToken(user), { status: 201 });
  }),

  http.post(apiUrl('/auth/register/beneficiario'), async ({ request }) => {
    await networkDelay();
    const d = (await request.json()) as Record<string, string>;
    if (buscar(d.email!))
      return conflicto('Ya hay una cuenta con ese correo. Inicia sesión.');
    const user: User = {
      id: `u_${crypto.randomUUID()}`,
      role: 'beneficiario',
      name: d.nombre!,
      documento: d.documento,
      telefono: d.telefono,
      email: d.email!.toLowerCase(),
      rootMandateId: null,
      mandateId: d.mandateId,
    };
    registradas.push({ user, password: d.password! });
    return HttpResponse.json(conToken(user), { status: 201 });
  }),
];
