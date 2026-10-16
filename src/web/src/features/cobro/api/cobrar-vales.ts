import { type Voucher, type VoucherSettleResult } from '@openroute/shared';

import { api } from '@/lib/api-client';

// OFF-03 / OFF-06: el gateway verifica cada vale, el Guardián lo revisa y se
// paga de verdad por Open Payments a la wallet de la tienda.
export const cobrarVales = async (
  vouchers: Voucher[],
): Promise<VoucherSettleResult[]> =>
  (
    (await api.post('/vouchers/settle', { vouchers })) as unknown as {
      results: VoucherSettleResult[];
    }
  ).results;
