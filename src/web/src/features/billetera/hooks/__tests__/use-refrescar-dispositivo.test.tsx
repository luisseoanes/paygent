import { amount as A } from '@openroute/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';

import {
  type Dispositivo,
  useDispositivoStore,
} from '@/features/billetera/stores/dispositivo-store';
import { server } from '@/testing/mocks/server';
import { apiUrl } from '@/testing/mocks/utils';

import { useRefrescarDispositivo } from '../use-refrescar-dispositivo';

vi.mock('@/lib/offline-store', () => ({
  offlineStore: { get: async () => undefined, set: async () => {}, del: async () => {} },
}));

// Un celular enlazado ayer, con la TRM de respaldo y un certificado que aún no hay que renovar.
const celular = (): Dispositivo => {
  const now = Date.now();
  return {
    mandateId: 'pedro-cel',
    publicKey: 'llave',
    secretKey: 'secreta',
    cert: {
      certId: 'cert_pedro',
      deviceKeyId: 'dev_pedro',
      mandateId: 'pedro-cel',
      publicKey: 'llave',
      offlineCap: A.usd(2),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 3 * 24 * 3600_000).toISOString(),
      signature: '',
    },
    gatewayPublicKey: '',
    counter: 0,
    cumulativeCents: 0,
    merchants: [],
    fx: 4000,
    vales: [],
  } as unknown as Dispositivo;
};

beforeEach(() => useDispositivoStore.setState({ dispositivo: celular() }));

test('si la rama del celular ya no existe, deja de firmar vales', async () => {
  server.use(
    http.get(apiUrl('/mandates/:id'), () =>
      HttpResponse.json({ error: 'Mandato no encontrado' }, { status: 404 }),
    ),
  );
  renderHook(() => useRefrescarDispositivo());
  await waitFor(() =>
    expect(useDispositivoStore.getState().dispositivo?.congelado).toBe(true),
  );
});

test('con señal toma la TRM del día aunque no renueve el certificado', async () => {
  server.use(
    http.get(apiUrl('/mandates/:id'), () =>
      HttpResponse.json({
        id: 'pedro-cel',
        frozen: false,
        revoked: false,
        offlineCap: A.usd(2),
        categories: ['mercado'],
      }),
    ),
    http.get(apiUrl('/fx'), () =>
      HttpResponse.json({ copPerUsd: 3174.67, fecha: '2026-10-17', fuente: 'trm' }),
    ),
  );
  renderHook(() => useRefrescarDispositivo());
  await waitFor(() =>
    expect(useDispositivoStore.getState().dispositivo?.fx).toBe(3174.67),
  );
  const d = useDispositivoStore.getState().dispositivo!;
  expect(d.fxFecha).toBe('2026-10-17');
  expect(d.cert.certId).toBe('cert_pedro');
});
