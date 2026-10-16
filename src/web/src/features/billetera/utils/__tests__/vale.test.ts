// @vitest-environment node
// tweetnacl compara Uint8Array por realm: con jsdom fallaría.
import { verifyVoucherOffline } from '@openroute/shared';

import { type Dispositivo } from '@/features/billetera/stores/dispositivo-store';
import {
  celularDePrueba,
  gatewayDePrueba,
  tiendaDePrueba,
} from '@/testing/vales';

import { crearVale, disponibleSinSenalCop } from '../vale';

const dispositivo = (): Dispositivo => {
  const { keys, cert } = celularDePrueba(20);
  return {
    mandateId: 'maria-device',
    ...keys,
    cert,
    gatewayPublicKey: gatewayDePrueba.publicKey,
    counter: 0,
    cumulativeCents: 0,
    merchants: [tiendaDePrueba],
    fx: 4000,
    vales: [],
  };
};

test('signs a voucher offline that the gateway key verifies', () => {
  const d = dispositivo();
  const r = crearVale(d, tiendaDePrueba, 12_000);
  if (!r.ok) throw new Error(r.motivo);

  expect(verifyVoucherOffline(r.voucher, gatewayDePrueba.publicKey)).toEqual({
    ok: true,
  });
  expect(r.voucher.amount.value).toBe('300');
  expect(r.siguiente.counter).toBe(1);
  expect(disponibleSinSenalCop(r.siguiente)).toBe(68_000);
});

test('never lets the offline total pass the certificate cap', () => {
  const d = dispositivo();
  const primero = crearVale(d, tiendaDePrueba, 60_000);
  if (!primero.ok) throw new Error(primero.motivo);

  const segundo = crearVale(primero.siguiente, tiendaDePrueba, 30_000);
  expect(segundo).toEqual({
    ok: false,
    motivo: 'Supera lo que puedes gastar sin señal.',
  });
});
