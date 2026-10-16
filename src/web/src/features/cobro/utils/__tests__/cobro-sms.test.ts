// @vitest-environment node
// tweetnacl compara Uint8Array por realm: con jsdom fallaría.
import {
  amount as A,
  decodeVoucherSms,
  randomId,
  signDeviceCert,
  signVoucher,
  type Voucher,
} from '@openroute/shared';

import {
  celularDePrueba,
  gatewayDePrueba,
  tiendaDePrueba,
} from '@/testing/vales';

import { enlaceCobroSms } from '../cobro-sms';

const vale = (certId: string): Voucher => {
  const { keys, cert: base } = celularDePrueba(A.cop(80_000));
  const { signature: _s, ...sinFirma } = base;
  const cert = signDeviceCert(
    { ...sinFirma, certId },
    gatewayDePrueba.secretKey,
  );
  return signVoucher(
    {
      voucherId: randomId('v_'),
      deviceKeyId: cert.deviceKeyId,
      deviceCert: cert,
      merchantWallet: tiendaDePrueba.wallet,
      category: 'mercado',
      amount: A.cop(12_000),
      counter: 1,
      cumulative: A.cop(12_000),
      createdAt: new Date().toISOString(),
    },
    keys.secretKey,
  );
};

describe('Cobrar por SMS', () => {
  it('arma un enlace sms: al número del gateway con el vale compacto', () => {
    const v = vale(randomId('cert_'));
    const href = enlaceCobroSms('+573001234567', v) ?? '';
    expect(href).toMatch(/^sms:\+573001234567\?body=VALE%20/);
    const body = decodeURIComponent(href.split('?body=')[1] ?? '');
    const back = decodeVoucherSms(body, {
      cert: () => v.deviceCert,
      wallets: [tiendaDePrueba.wallet],
    });
    expect(back).toEqual(v);
  });

  it('sin número configurado o con un vale que no se puede comprimir, no hay enlace', () => {
    expect(enlaceCobroSms(undefined, vale(randomId('cert_')))).toBeUndefined();
    expect(enlaceCobroSms('+573001234567', vale('cert_test'))).toBeUndefined();
  });
});
