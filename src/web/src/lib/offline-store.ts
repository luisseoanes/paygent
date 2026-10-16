import { createStore, del, get, set } from 'idb-keyval';

// IndexedDB: lo que María y el tendero necesitan en modo avión (llaves,
// certificado, cola de vales). Sobrevive a recargar la PWA.
const store = createStore('paygent', 'kv');

export const offlineStore = {
  get: <T>(key: string) => get<T>(key, store),
  set: (key: string, value: unknown) => set(key, value, store),
  del: (key: string) => del(key, store),
};
