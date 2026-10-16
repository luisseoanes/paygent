import {
  type Merchant,
  type Voucher,
  decodeVoucher,
  verifyVoucherOffline,
} from '@openroute/shared';

import { type ValeRecibido } from '../stores/cobro-store';

// OFF-05: verificación 100% sin red con la llave pública del gateway (la
// misma función que usa el gateway al cobrar). Devuelve un motivo que el
// tendero entiende, no el técnico.

const MOTIVOS: [RegExp, string][] = [
  [
    /replay|ya fue recibido|ya se cobr/i,
    'Este vale ya se cobró. Pide uno nuevo.',
  ],
  [
    /firma|certificado del dispositivo|no corresponde|bad_signature/i,
    'Este vale fue alterado. No lo aceptes.',
  ],
  [
    /vencid|expired/i,
    'El vale está vencido. El cliente debe conectarse un momento.',
  ],
  [
    /tope|acumulado|over_limit/i,
    'Supera lo que este celular puede gastar sin señal.',
  ],
  [/otro comercio|otra tienda/i, 'Este vale es para otra tienda.'],
  [/revoked|revocad/i, 'El permiso de este celular fue revocado.'],
  [/frozen|congelad/i, 'Este celular está en pausa. No se puede cobrar.'],
  [
    /category|categor/i,
    'Este celular no puede comprar en este tipo de tienda.',
  ],
];

export const motivoLegible = (reason?: string) => {
  if (!reason) return 'No se pudo cobrar.';
  return MOTIVOS.find(([re]) => re.test(reason))?.[1] ?? reason;
};

export type Verificacion =
  { ok: true; voucher: Voucher } | { ok: false; motivo: string };

export const verificarVale = (
  raw: string,
  {
    gatewayPublicKey,
    merchant,
    vales,
  }: {
    gatewayPublicKey?: string;
    merchant?: Merchant;
    vales: ValeRecibido[];
  },
): Verificacion => {
  let voucher: Voucher;
  try {
    voucher = decodeVoucher(raw.trim());
    if (!voucher?.deviceCert || !voucher.signature) throw new Error();
  } catch {
    return { ok: false, motivo: 'Ese código no es un vale de Paygent.' };
  }
  if (!gatewayPublicKey)
    return {
      ok: false,
      motivo: 'Abre esta app con señal una vez para poder verificar sin ella.',
    };
  const check = verifyVoucherOffline(voucher, gatewayPublicKey);
  if (!check.ok) return { ok: false, motivo: motivoLegible(check.reason) };
  if (merchant && voucher.merchantWallet !== merchant.wallet)
    return { ok: false, motivo: motivoLegible('otra tienda') };
  const repetido = vales.some(
    (v) =>
      v.voucher.deviceCert.certId === voucher.deviceCert.certId &&
      v.voucher.counter === voucher.counter,
  );
  if (repetido) return { ok: false, motivo: motivoLegible('replay') };
  return { ok: true, voucher };
};
