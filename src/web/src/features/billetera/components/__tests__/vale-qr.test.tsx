import { type Merchant, type Voucher } from '@openroute/shared';

import { renderApp, screen, userEvent } from '@/testing/test-utils';

import { ValeQr } from '../vale-qr';

// Tras mostrar el vale, la persona vuelve a su billetera o paga otra vez sin pasar por el inicio.
test('desde el vale se vuelve a la billetera o se hace otro pago', async () => {
  const onListo = vi.fn();
  const onOtroPago = vi.fn();
  const voucher = {
    voucherId: 'v_1',
    deviceKeyId: 'dev_1',
    deviceCert: { certId: 'cert_1', mandateId: 'maria-device', signature: 's' },
    merchantWallet: 'https://w/farmacia',
    category: 'farmacia',
    amount: { value: '2000000', assetCode: 'COP', assetScale: 2 },
    counter: 1,
    cumulative: { value: '2000000', assetCode: 'COP', assetScale: 2 },
    createdAt: new Date().toISOString(),
    signature: 'firma',
  } as unknown as Voucher;
  const merchant = {
    id: 'farmacia',
    name: 'Farmacia San José',
    wallet: 'https://w/farmacia',
    category: 'farmacia',
  } as Merchant;

  await renderApp(
    <ValeQr
      voucher={voucher}
      merchant={merchant}
      cop={20_000}
      onListo={onListo}
      onOtroPago={onOtroPago}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /mi billetera/i }));
  expect(onListo).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: /otro pago/i }));
  expect(onOtroPago).toHaveBeenCalledOnce();
});
