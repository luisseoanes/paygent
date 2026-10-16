// @vitest-environment node
// tweetnacl compara Uint8Array por realm: con jsdom fallaría.
import {
  amount as A,
  encodeVoucher,
  signVoucher,
  type Voucher,
} from '@openroute/shared';

import {
  celularDePrueba,
  gatewayDePrueba,
  tiendaDePrueba,
} from '@/testing/vales';

import { verificarVale } from '../verificar';

const valeFirmado = (): Voucher => {
  const { keys, cert } = celularDePrueba(20);
  return signVoucher(
    {
      voucherId: 'v_1',
      deviceKeyId: cert.deviceKeyId,
      deviceCert: cert,
      merchantWallet: tiendaDePrueba.wallet,
      category: 'mercado',
      amount: A.usd(3),
      counter: 1,
      cumulative: A.usd(3),
      createdAt: new Date().toISOString(),
    },
    keys.secretKey,
  );
};

const opciones = {
  gatewayPublicKey: gatewayDePrueba.publicKey,
  merchant: tiendaDePrueba,
  vales: [],
};

test('accepts a valid voucher with no network', () => {
  const vale = valeFirmado();
  expect(verificarVale(encodeVoucher(vale), opciones)).toEqual({
    ok: true,
    voucher: vale,
  });
});

test('rejects a voucher altered by one peso', () => {
  const vale = valeFirmado();
  const alterado = { ...vale, amount: { ...vale.amount, value: '301' } };
  expect(verificarVale(encodeVoucher(alterado), opciones)).toEqual({
    ok: false,
    motivo: 'Este vale fue alterado. No lo aceptes.',
  });
});

test('rejects a voucher for another shop or one already received', () => {
  const vale = valeFirmado();
  expect(
    verificarVale(encodeVoucher(vale), {
      ...opciones,
      merchant: { ...tiendaDePrueba, wallet: 'https://otra' },
    }),
  ).toEqual({ ok: false, motivo: 'Este vale es para otra tienda.' });
  expect(
    verificarVale(encodeVoucher(vale), {
      ...opciones,
      vales: [{ voucher: vale, status: 'settled', scannedAt: '' }],
    }),
  ).toEqual({ ok: false, motivo: 'Este vale ya se cobró. Pide uno nuevo.' });
});

test('says plainly when the code is not a voucher', () => {
  expect(verificarVale('hola', opciones)).toEqual({
    ok: false,
    motivo: 'Ese código no es un vale de Paygent.',
  });
});
