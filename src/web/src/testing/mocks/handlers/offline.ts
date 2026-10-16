import {
  type Merchant,
  type Voucher,
  type VoucherSettleResult,
  keyPairFromSeed,
  randomId,
  signDeviceCert,
  toB64,
  verifyVoucherOffline,
} from '@openroute/shared';
import { HttpResponse, http } from 'msw';

import { type Amount, type MandateTree } from '@/types/api';

import { db, findInTree, usdAmount } from '../db';
import { apiUrl, networkDelay } from '../utils';

// Modo sin señal (OFF-02, OFF-03) con la criptografía real de src/shared: el
// gateway simulado firma certificados y verifica vales igual que src/api.

const gateway = keyPairFromSeed(
  toB64(new TextEncoder().encode('paygent-gateway-mock-seed-32byte')),
);

export const mockMerchants: Merchant[] = [
  {
    id: 'tienda',
    name: 'Tienda Doña Rosa',
    wallet: 'https://ilp.interledger-test.dev/tienda-dona-rosa',
    category: 'mercado',
  },
  {
    id: 'farmacia',
    name: 'Farmacia San José',
    wallet: 'https://ilp.interledger-test.dev/farmacia-san-jose',
    category: 'farmacia',
  },
  {
    id: 'puntored',
    name: 'Puntored Efectivo',
    wallet: 'https://ilp.interledger-test.dev/puntored',
    category: 'efectivo',
  },
];

const cents = (a: Amount) => Number(a.value);
const fail = (error: string, status: number) =>
  HttpResponse.json({ error }, { status });

const cadena = (node: MandateTree): MandateTree[] => {
  const out = [node];
  let actual = node;
  while (actual.parentId) {
    const padre = findInTree(db.tree, actual.parentId);
    if (!padre) break;
    out.push(padre);
    actual = padre;
  }
  return out;
};

const cobrar = (v: Voucher): VoucherSettleResult => {
  const check = verifyVoucherOffline(v, gateway.publicKey);
  if (!check.ok)
    return { voucherId: v.voucherId, status: 'rejected', reason: check.reason };
  const llave = `${v.deviceCert.certId}:${v.counter}`;
  const node = findInTree(db.tree, v.deviceCert.mandateId);
  if (db.valesCobrados.has(llave)) {
    db.feed.unshift({
      id: `evt_${Date.now()}_${db.feed.length}`,
      at: new Date().toISOString(),
      mandateId: v.deviceCert.mandateId,
      actor: { type: 'agent', name: 'Agente Guardián' },
      kind: 'guardian',
      amount: v.amount,
      reason: `Rechazó un vale repetido (N.º ${v.counter}). El original sí se pagó.`,
    });
    return { voucherId: v.voucherId, status: 'rejected', reason: 'replay' };
  }
  if (!node || node.revoked || node.frozen)
    return {
      voucherId: v.voucherId,
      status: 'rejected',
      reason: node?.revoked ? 'revoked' : 'frozen',
    };
  db.valesCobrados.add(llave);
  cadena(node).forEach((n) => {
    n.spentInPeriod = usdAmount(
      (cents(n.spentInPeriod) + cents(v.amount)) / 100,
    );
  });
  db.feed.unshift({
    id: `evt_${Date.now()}_${db.feed.length}`,
    at: new Date().toISOString(),
    mandateId: node.id,
    actor: { type: 'device', name: node.holderName },
    kind: 'voucher_settled',
    amount: v.amount,
    merchant: mockMerchants.find((m) => m.wallet === v.merchantWallet)?.name,
    reason: `Vale N.º ${v.counter} firmado en el celular; se cobró en la tienda.`,
  });
  return {
    voucherId: v.voucherId,
    status: 'settled',
    paymentId: randomId('pay_'),
  };
};

export const offlineHandlers = [
  http.get(apiUrl('/merchants'), async () => {
    await networkDelay();
    return HttpResponse.json(mockMerchants);
  }),

  http.get(apiUrl('/gateway/public-key'), async () => {
    await networkDelay();
    return HttpResponse.json({ publicKey: gateway.publicKey });
  }),

  http.get(apiUrl('/mandates/:mandateId'), async ({ params }) => {
    await networkDelay();
    const node = findInTree(db.tree, String(params.mandateId));
    if (!node) return fail('Mandato no existe', 404);
    const { children: _children, ...mandate } = node;
    return HttpResponse.json({
      ...mandate,
      remaining: usdAmount(
        Math.max(0, cents(node.maxDebit) - cents(node.spentInPeriod)) / 100,
      ),
    });
  }),

  http.post(
    apiUrl('/mandates/:mandateId/device-key'),
    async ({ params, request }) => {
      await networkDelay();
      const node = findInTree(db.tree, String(params.mandateId));
      if (!node) return fail('Mandato no existe', 404);
      if (node.holderType !== 'device')
        return fail('El mandato no es de un dispositivo', 400);
      if (node.revoked || node.frozen)
        return fail(
          'El mandato del dispositivo está revocado o congelado',
          403,
        );
      if (!node.offlineCap)
        return fail('El mandato no tiene tope offline', 400);
      const { publicKey } = (await request.json()) as { publicKey: string };
      const now = new Date();
      const cert = signDeviceCert(
        {
          certId: randomId('cert_'),
          deviceKeyId: `dev_${publicKey.slice(0, 8)}`,
          mandateId: node.id,
          publicKey,
          offlineCap: node.offlineCap,
          issuedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000).toISOString(),
        },
        gateway.secretKey,
      );
      return HttpResponse.json({
        deviceKeyId: cert.deviceKeyId,
        cert,
        offlineCap: cert.offlineCap,
        gatewayPublicKey: gateway.publicKey,
      });
    },
  ),

  http.post(apiUrl('/vouchers/settle'), async ({ request }) => {
    await networkDelay();
    const { vouchers } = (await request.json()) as { vouchers: Voucher[] };
    return HttpResponse.json({ results: vouchers.map(cobrar) });
  }),
];
