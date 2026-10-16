import {
  type Merchant,
  type Voucher,
  type VoucherSettleResult,
} from '@openroute/shared';
import { create } from 'zustand';

import { offlineStore } from '@/lib/offline-store';

// La caja del tendero: su tienda, la llave del gateway para verificar sin red
// y los vales recibidos (la cola). Vive en IndexedDB: funciona en modo avión.

export type EstadoVale = 'pending' | VoucherSettleResult['status'];

export type ValeRecibido = {
  voucher: Voucher;
  status: EstadoVale;
  reason?: string;
  scannedAt: string;
};

type Datos = {
  merchantId?: string;
  merchants: Merchant[];
  gatewayPublicKey?: string;
  fx: number;
  vales: ValeRecibido[];
};

const KEY = 'tendero';
const VACIO: Datos = { merchants: [], fx: 4000, vales: [] };

type CobroStore = Datos & {
  cargado: boolean;
  cargar: () => Promise<void>;
  configurar: (
    datos: Pick<Datos, 'merchants' | 'gatewayPublicKey' | 'fx'>,
  ) => Promise<void>;
  elegirTienda: (merchantId: string | undefined) => Promise<void>;
  recibir: (voucher: Voucher) => Promise<void>;
  aplicarResultados: (results: VoucherSettleResult[]) => Promise<void>;
};

export const useCobroStore = create<CobroStore>((set, get) => {
  const persistir = async (cambios: Partial<Datos>) => {
    set(cambios);
    const { merchantId, merchants, gatewayPublicKey, fx, vales } = get();
    await offlineStore.set(KEY, {
      merchantId,
      merchants,
      gatewayPublicKey,
      fx,
      vales,
    });
  };

  return {
    ...VACIO,
    cargado: false,
    cargar: async () => {
      const datos = (await offlineStore.get<Datos>(KEY)) ?? VACIO;
      set({ ...VACIO, ...datos, cargado: true });
    },
    configurar: (datos) => persistir(datos),
    elegirTienda: (merchantId) => persistir({ merchantId }),
    recibir: (voucher) =>
      persistir({
        vales: [
          { voucher, status: 'pending', scannedAt: new Date().toISOString() },
          ...get().vales,
        ],
      }),
    aplicarResultados: (results) =>
      persistir({
        vales: get().vales.map((v) => {
          const r = results.find((x) => x.voucherId === v.voucher.voucherId);
          return r && v.status === 'pending'
            ? { ...v, status: r.status, reason: r.reason }
            : v;
        }),
      }),
  };
});
