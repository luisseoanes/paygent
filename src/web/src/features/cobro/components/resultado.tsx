import { amount as A } from '@openroute/shared';
import { CircleX, ScanLine } from 'lucide-react';

import { Sello } from '@/components/brand/sello';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils/cn';
import { formatCop } from '@/utils/format';

import { useCobroStore } from '../stores/cobro-store';
import { estadoVale } from '../utils/estado';
import { motivoLegible } from '../utils/verificar';

// Resultado del escaneo a pantalla completa: se entiende sin leer (sello y
// color) y sin mirar (vibración y tono, ver utils/aviso). Con señal se ve
// "Cobrando…" y cae el sello COBRADO; sin señal queda POR COBRAR.

export type ResultadoEscaneo =
  { ok: true; voucherId: string } | { ok: false; motivo: string };

export const Resultado = ({
  resultado,
  online,
  sincronizando,
  onOtro,
  onListo,
}: {
  resultado: ResultadoEscaneo;
  online: boolean;
  sincronizando: boolean;
  onOtro: () => void;
  onListo: () => void;
}) => {
  const fx = useCobroStore((s) => s.fx);
  const vale = useCobroStore((s) =>
    resultado.ok
      ? s.vales.find((v) => v.voucher.voucherId === resultado.voucherId)
      : undefined,
  );

  const cobrando = vale?.status === 'pending' && online && sincronizando;
  const rechazado = !resultado.ok || vale?.status === 'rejected';
  const motivo = !resultado.ok
    ? resultado.motivo
    : vale?.status === 'rejected'
      ? motivoLegible(vale.reason)
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <div
        role="status"
        aria-live="assertive"
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl px-6 py-10 text-center',
          rechazado ? 'bg-anulado-tint/70' : 'bg-paper-raised',
        )}
      >
        {cobrando ? (
          <>
            <Spinner size="xl" />
            <p className="text-lg text-grafito">Cobrando…</p>
          </>
        ) : rechazado ? (
          <>
            {vale ? (
              <Sello
                variant="rechazado"
                size="lg"
                seed={vale.voucher.voucherId}
              />
            ) : (
              <CircleX className="size-20 text-anulado" aria-hidden="true" />
            )}
            <p className="text-xl font-medium text-anulado">No lo aceptes</p>
            <p className="max-w-xs text-[0.9375rem] text-grafito">{motivo}</p>
          </>
        ) : vale ? (
          <>
            <Sello
              variant={estadoVale[vale.status].sello}
              label={estadoVale[vale.status].label}
              size="lg"
              seed={vale.voucher.voucherId}
            />
            <p className="cifra text-[3rem] leading-none font-light tracking-[-0.03em] text-grafito">
              {formatCop(A.toCop(vale.voucher.amount, fx))}
            </p>
            <p className="max-w-xs text-[0.9375rem] text-ink-2">
              {vale.status === 'pending'
                ? 'Vale válido. Quedó guardado y se cobra solo cuando vuelva la señal.'
                : vale.status === 'flagged'
                  ? `Cobrado. El Guardián lo marcó: ${vale.reason ?? 'revísalo'}.`
                  : 'Cobrado. La plata ya va para tu tienda.'}
            </p>
          </>
        ) : null}
      </div>

      <div className="space-y-2">
        <Button
          size="xl"
          className="w-full rounded-full"
          icon={<ScanLine aria-hidden="true" />}
          onClick={onOtro}
        >
          Escanear otro
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full rounded-full"
          onClick={onListo}
        >
          Volver a la caja
        </Button>
      </div>
    </div>
  );
};
