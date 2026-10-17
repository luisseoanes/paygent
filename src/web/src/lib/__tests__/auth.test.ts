import { currentUserId, pedirCierreDeSesion } from '../auth';

test('logging out forgets the session at once, even if the page has to reload before arriving home', () => {
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({ id: 'u1', role: 'titular', rootMandateId: 'root_u1' }),
  );
  pedirCierreDeSesion();
  // Si al salir hay que recargar (versión nueva), la sesión no vuelve.
  expect(sessionStorage.getItem('paygent-session')).toBeNull();
  expect(currentUserId()).toBeNull();
});
