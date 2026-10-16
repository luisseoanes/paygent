import { Store } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';

import { useCobroStore } from '../stores/cobro-store';

// Primer uso: ¿cuál es tu tienda? Así la caja sabe qué vales son suyos.
export const ElegirTienda = ({ online }: { online: boolean }) => {
  const merchants = useCobroStore((s) => s.merchants);
  const elegirTienda = useCobroStore((s) => s.elegirTienda);

  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <div className="space-y-2">
        <span
          aria-hidden="true"
          className="inline-flex size-12 items-center justify-center rounded-2xl bg-liquidado-tint text-liquidado"
        >
          <Store className="size-6" />
        </span>
        <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em] text-grafito">
          ¿Cuál es tu tienda?
        </h1>
        <p className="text-[0.9375rem] text-ink-2">
          Solo la eliges una vez. Después cobras con o sin señal.
        </p>
      </div>
      {merchants.length === 0 ? (
        online ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <p className="rounded-2xl bg-pendiente-tint p-4 text-sm text-pendiente">
            Abre la app con señal una vez para descargar las tiendas y poder
            verificar vales sin ella.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {merchants.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => elegirTienda(m.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-paper-raised px-4 py-3 text-left text-[0.9375rem] font-medium text-grafito transition-colors hover:bg-hueso-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Store className="size-5 text-ink-2" aria-hidden="true" />
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
