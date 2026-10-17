import {
  amount as A,
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
  // TRM con que se muestran en pesos los vales en USD, y su día (null = respaldo)
  fx: number;
  fxFecha?: string | null;
  vales: ValeRecibido[];
};

const KEY = 'tendero';
const VACIO: Datos = {
  merchants: [],
  fx: A.DEFAULT_FX_COP_PER_USD,
  vales: [],
};

type CobroStore = Datos & {
  cargado: boolean;
  cargar: () => Promise<void>;
  configurar: (
    datos: Pick<Datos, 'merchants' | 'gatewayPublicKey' | 'fx' | 'fxFecha'>,
  ) => Promise<void>;
  elegirTienda: (merchantId: string | undefined) => Promise<void>;
  recibir: (voucher: Voucher) => Promise<void>;
  aplicarResultados: (results: VoucherSettleResult[]) => Promise<void>;
};

export const useCobroStore = create<CobroStore>((set, get) => {
  const persistir = async (cambios: Partial<Datos>) => {
    set(cambios);
    const { merchantId, merchants, gatewayPublicKey, fx, fxFecha, vales } =
      get();
    await offlineStore.set(KEY, {
      merchantId,
      merchants,
      gatewayPublicKey,
      fx,
      fxFecha,
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
