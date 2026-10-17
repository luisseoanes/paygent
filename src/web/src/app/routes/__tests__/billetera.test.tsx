import { amount as A } from '@openroute/shared';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router';

import { AppProvider } from '@/app/provider';
import { useDispositivoStore } from '@/features/billetera/stores/dispositivo-store';
import { server } from '@/testing/mocks/server';
import { apiUrl } from '@/testing/mocks/utils';
import { rtlRender, screen, waitFor } from '@/testing/test-utils';

import BilleteraRoute from '../billetera';

// IndexedDB en memoria: el mismo navegador para las dos cuentas.
const guardado = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/lib/offline-store', () => ({
  offlineStore: {
    get: async (k: string) => guardado.get(k),
    set: async (k: string, v: unknown) => void guardado.set(k, v),
    del: async (k: string) => void guardado.delete(k),
  },
}));

// Un certificado sin firmar: tweetnacl compara Uint8Array por realm y con jsdom falla; aquí no se prueba la firma.
const certificado = (
  mandateId: string,
  publicKey: string,
  offlineCap = A.usd(5),
) => {
  const now = new Date();
  return {
    certId: `cert_${mandateId}`,
    deviceKeyId: `dev_${mandateId}`,
    mandateId,
    publicKey,
    offlineCap,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
    signature: '',
  };
};

// Otro beneficiario (tope de 20.000) enlazó su celular en este navegador.
const celularDeOtro = () => {
  return {
    mandateId: 'b_otro-cel',
    publicKey: 'llave-del-otro',
    secretKey: 'secreta-del-otro',
    cert: certificado('b_otro-cel', 'llave-del-otro'),
    gatewayPublicKey: '',
    counter: 0,
    cumulativeCents: 0,
    merchants: [],
    fx: 4000,
    remaining: A.usd(5),
    remainingAt: new Date().toISOString(),
    vales: [],
  };
};

const entrarComoMaria = () =>
  sessionStorage.setItem(
    'paygent-session',
    JSON.stringify({
      id: 'maria',
      role: 'beneficiario',
      name: 'María',
      email: 'maria@paygent.dev',
      rootMandateId: null,
      mandateId: 'maria-device',
      mandateIds: ['maria-device', 'mnd_maria'],
    }),
  );

afterEach(() => guardado.clear());

test('al entrar con otra cuenta no se ve el saldo del celular de la anterior: se enlaza el suyo', async () => {
  guardado.set('maria-dispositivo', celularDeOtro());
  entrarComoMaria();
  server.use(
    http.post(
      apiUrl('/mandates/:mandateId/device-key'),
      async ({ params, request }) => {
        const { publicKey } = (await request.json()) as { publicKey: string };
        const cert = certificado(
          String(params.mandateId),
          publicKey,
          A.usd(30),
        );
        return HttpResponse.json({
          deviceKeyId: cert.deviceKeyId,
          cert,
          offlineCap: cert.offlineCap,
          gatewayPublicKey: 'llave-del-gateway',
        });
      },
    ),
  );

  // Sin renderApp: la billetera siempre muestra el estado de la conexión (role=status).
  rtlRender(
    <AppProvider>
      <MemoryRouter>
        <BilleteraRoute />
      </MemoryRouter>
    </AppProvider>,
  );

  await waitFor(() =>
    expect(useDispositivoStore.getState().dispositivo?.mandateId).toBe(
      'maria-device',
    ),
  );
  // Lo de la persona María (88 USD a 4.000), no lo de su celular ni lo del otro.
  const titulo = await screen.findByRole('heading', {
    name: /puedes gastar este mes/i,
  });
  await waitFor(() =>
    expect(titulo.nextElementSibling).toHaveTextContent(/352\.000/),
  );
  expect(screen.queryByText(/(^|[^\d.])20\.000/)).not.toBeInTheDocument();
});
