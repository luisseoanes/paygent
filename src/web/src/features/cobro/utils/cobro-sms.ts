import { encodeVoucherSms, type Voucher } from '@openroute/shared';

// Sin datos pero con señal de SMS: el vale viaja en un SMS al número del gateway.
export const enlaceCobroSms = (
  numero: string | undefined,
  voucher: Voucher,
): string | undefined => {
  if (!numero) return undefined;
  try {
    return `sms:${numero}?body=${encodeURIComponent(encodeVoucherSms(voucher))}`;
  } catch {
    return undefined;
  }
};
