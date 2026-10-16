import {
  type Amount,
  type Category,
  type DeviceCert,
  type Merchant,
} from '@openroute/shared';
import { create } from 'zustand';

import { offlineStore } from '@/lib/offline-store';

// El celular de María: sus llaves (nunca salen del teléfono), el certificado
// que le dio el gateway y lo que gastó con él. Vive en IndexedDB para que
// pagar funcione en modo avión.

export type ValeEmitido = {
  voucherId: string;
  counter: number;
  merchantName: string;
  cop: number;
  createdAt: string;
};

export type Dispositivo = {
  mandateId: string;
  publicKey: string;
  secretKey: string;
  cert: DeviceCert;
  gatewayPublicKey: string;
  // Último contador usado y acumulado (centavos USD) con el certificado actual
  counter: number;
  cumulativeCents: number;
  merchants: Merchant[];
  fx: number;
  categories?: Category[];
  // Saldo del periodo de la rama la última vez que hubo señal
  remaining?: Amount;
  remainingAt?: string;
  vales: ValeEmitido[];
};

const KEY = 'maria-dispositivo';

type DispositivoStore = {
  cargado: boolean;
  dispositivo: Dispositivo | null;
  cargar: () => Promise<void>;
  guardar: (d: Dispositivo) => Promise<void>;
  olvidar: () => Promise<void>;
};

export const useDispositivoStore = create<DispositivoStore>((set) => ({
  cargado: false,
  dispositivo: null,
  cargar: async () => {
    const dispositivo = (await offlineStore.get<Dispositivo>(KEY)) ?? null;
    set({ dispositivo, cargado: true });
  },
  guardar: async (d) => {
    await offlineStore.set(KEY, d);
    set({ dispositivo: d });
  },
  olvidar: async () => {
    await offlineStore.del(KEY);
    set({ dispositivo: null });
  },
}));
