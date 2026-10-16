import {
  amount as A,
  type Category,
  type Merchant,
  type Voucher,
  randomId,
  signVoucher,
} from '@openroute/shared';

import { type Dispositivo } from '../stores/dispositivo-store';

// Firma un vale en el celular, sin red: el monto pasa de COP a la moneda de
// Juan (la del tope del certificado; sin conversión si es COP), el contador
// sube y el acumulado nunca pasa del tope sin señal del certificado.

const monedaRaiz = (d: Dispositivo) => A.assetOf(d.cert.offlineCap);
const enRaiz = (d: Dispositivo, minor: number) => ({
  ...monedaRaiz(d),
  value: String(minor),
});

export const topeSinSenalCents = (d: Dispositivo) =>
  Number(d.cert.offlineCap.value);

export const disponibleSinSenalCop = (d: Dispositivo) =>
  d.congelado
    ? 0
    : A.toCop(
        enRaiz(d, Math.max(0, topeSinSenalCents(d) - d.cumulativeCents)),
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
  if (d.congelado)
    return {
      ok: false,
      motivo:
        'Los pagos sin señal están pausados. Conéctate y habla con quien te da el dinero.',
    };
  if (certificadoVencido(d, now))
    return {
      ok: false,
      motivo:
        'Tu permiso sin señal venció. Conéctate un momento para renovarlo.',
    };
  const amount = A.fromCop(cop, monedaRaiz(d), d.fx);
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
      cumulative: enRaiz(d, cumulativeCents),
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
