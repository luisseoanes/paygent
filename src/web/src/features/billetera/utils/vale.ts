import {
  amount as A,
  type Category,
  type Merchant,
  type Voucher,
  randomId,
  signVoucher,
} from '@openroute/shared';

import { type Dispositivo } from '../stores/dispositivo-store';

// Firma un vale en el celular, sin red: el monto se convierte de COP a USD con
// la tasa de referencia, el contador sube y el acumulado nunca pasa del tope
// sin señal del certificado (lo mismo que verifica el tendero y el gateway).

export const topeSinSenalCents = (d: Dispositivo) =>
  Number(d.cert.offlineCap.value);

export const disponibleSinSenalCop = (d: Dispositivo) =>
  A.usdToCop(
    A.USD(Math.max(0, topeSinSenalCents(d) - d.cumulativeCents)),
    d.fx,
  );

export const certificadoVencido = (d: Dispositivo, now = new Date()) =>
  new Date(d.cert.expiresAt) < now;

export type ResultadoVale =
  | { ok: true; voucher: Voucher; siguiente: Dispositivo }
  | { ok: false; motivo: string };

export const crearVale = (
  d: Dispositivo,
  merchant: Merchant,
  cop: number,
  now = new Date(),
): ResultadoVale => {
  if (cop <= 0) return { ok: false, motivo: 'Escribe cuánto vas a pagar.' };
  if (certificadoVencido(d, now))
    return {
      ok: false,
      motivo:
        'Tu permiso sin señal venció. Conéctate un momento para renovarlo.',
    };
  const amount = A.copToUsd(cop, d.fx);
  const cumulativeCents = d.cumulativeCents + Number(amount.value);
  if (cumulativeCents > topeSinSenalCents(d))
    return {
      ok: false,
      motivo: 'Supera lo que puedes gastar sin señal.',
    };

  const counter = d.counter + 1;
  const voucher = signVoucher(
    {
      voucherId: randomId('v_'),
      deviceKeyId: d.cert.deviceKeyId,
      deviceCert: d.cert,
      merchantWallet: merchant.wallet,
      category: merchant.category as Category,
      amount,
      counter,
      cumulative: A.USD(cumulativeCents),
      createdAt: now.toISOString(),
    },
    d.secretKey,
  );
  return {
    ok: true,
    voucher,
    siguiente: {
      ...d,
      counter,
      cumulativeCents,
      vales: [
        {
          voucherId: voucher.voucherId,
          counter,
          merchantName: merchant.name,
          cop,
          createdAt: voucher.createdAt,
        },
        ...d.vales,
      ].slice(0, 20),
    },
  };
};

// Comercios donde la rama puede gastar (si se conocen sus categorías).
export const comerciosPermitidos = (d: Dispositivo) =>
  d.categories
    ? d.merchants.filter((m) => d.categories!.includes(m.category))
    : d.merchants;
