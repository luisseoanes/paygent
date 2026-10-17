import { pedirCierreDeSesion } from '../auth';
import { currentToken, readSession } from '../session';

test('logging out forgets the session at once, even if the page has to reload before arriving home', () => {
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({
      id: 'u1',
      role: 'titular',
      rootMandateId: 'root_u1',
      token: 't',
    }),
  );
  pedirCierreDeSesion();
  // Si al salir hay que recargar (versión nueva), la sesión no vuelve.
  expect(sessionStorage.getItem('paygent-session')).toBeNull();
  expect(readSession()).toBeNull();
  expect(currentToken()).toBeNull();
});
