import { ArrowLeft, CloudOff, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';

import { useHistorial } from '../api/get-historial';

import { Libreta } from './libreta';

// Todo el historial de una rama (una persona delegada y lo que cuelga de
// ella), con la misma libreta del panel: cada movimiento con su porqué.

export type HistorialRamaProps = {
  mandateId: string;
  // La raíz del árbol, si se conoce (el titular); si no, se busca.
  rootId?: string;
  titulo: string;
  // "Volver" (flecha) o "Cerrar" (X), según dónde se muestre
  onVolver?: () => void;
  onCerrar?: () => void;
  className?: string;
};

export const HistorialRama = ({
  mandateId,
  rootId,
  titulo,
  onVolver,
  onCerrar,
  className,
}: HistorialRamaProps) => {
  const historial = useHistorial({ mandateId, rootId });

  return (
    <section
      aria-labelledby="historial-titulo"
      className={cn('flex min-h-0 flex-col gap-3', className)}
    >
      <div className="flex items-center gap-2">
        {onVolver && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-3 rounded-full"
            aria-label="Volver"
            onClick={onVolver}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        <h2
          id="historial-titulo"
          className="min-w-0 flex-1 truncate text-lg font-medium text-grafito"
        >
          {titulo}
        </h2>
        {onCerrar && (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-3 rounded-full"
            aria-label="Cerrar historial"
            onClick={onCerrar}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="-mx-3 min-h-0 flex-1 overflow-y-auto">
        {historial.isPending ? (
          <div className="space-y-3 px-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : historial.isError ? (
          <EmptyState
            icon={<CloudOff />}
            title="No pudimos traer el historial"
            description="Revisa la conexión e inténtalo otra vez."
            action={
              <Button
                variant="outline"
                icon={<RotateCcw aria-hidden="true" />}
                onClick={() => historial.refetch()}
              >
                Reintentar
              </Button>
            }
            className="mx-3 rounded-2xl"
          />
        ) : (
          <Libreta events={historial.data} />
        )}
      </div>
    </section>
  );
};
