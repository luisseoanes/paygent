import { amount as A } from '@openroute/shared';
import { History, MessageCircle, QrCode } from 'lucide-react';
import type * as React from 'react';

import { ReglaDeConsumo } from '@/components/brand/regla-consumo';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/hooks/use-online';
import { etiquetaTasa } from '@/lib/catalogo';
import {
  formatCop,
  formatCurrency,
  formatDate,
  formatTime,
} from '@/utils/format';

import { type Dispositivo } from '../stores/dispositivo-store';
import { disponibleSinSenalCop } from '../utils/vale';

// Inicio de María: cuánto puede gastar (este mes, entre todas sus formas de
// pagar, y sin señal) y un solo botón grande para pagar. Debajo, sus vales.

export const InicioBilletera = ({
  dispositivo: d,
  onPagar,
  onAsistente,
  onHistorial,
  formasDePagar,
  desvincular,
}: {
  dispositivo: Dispositivo;
  onPagar: () => void;
  onAsistente?: () => void;
  onHistorial?: () => void;
  // Slot: las formas de pagar que le habilitó su titular (las compone la ruta)
  formasDePagar?: React.ReactNode;
  // Slot: el control para desvincular (lo compone la ruta con su confirmación)
  desvincular?: React.ReactNode;
}) => {
  const online = useOnline();
  const topeCop = A.toCop(d.cert.offlineCap, d.fx);
  const sinSenal = disponibleSinSenalCop(d);
  const delMes = d.remaining ? A.toCop(d.remaining, d.fx) : undefined;

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <section
        aria-labelledby="puedes-gastar"
        className="space-y-5 rounded-3xl bg-paper-raised p-5 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)]"
      >
        <div>
          <h1 id="puedes-gastar" className="text-sm text-ink-2">
            Puedes gastar este mes
          </h1>
          <p className="cifra text-[2.75rem] leading-none font-light tracking-[-0.03em] text-grafito">
            {delMes !== undefined ? formatCop(delMes) : '—'}
          </p>
          <p className="mt-1.5 text-xs text-ink-2">
            Entre todas tus formas de pagar.
          </p>
          {!online && d.remainingAt && (
            <p className="mt-1.5 text-xs text-ink-2">
              Con señal el{' '}
              {formatDate(d.remainingAt, { day: 'numeric', month: 'long' })} a
              las {formatTime(d.remainingAt).slice(0, 5)}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border-2 border-dashed border-rule-strong p-4">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-grafito">Sin señal te quedan</span>
            <span className="cifra text-lg text-grafito">
              {formatCop(sinSenal)}
            </span>
          </p>
          <ReglaDeConsumo
            spent={topeCop - sinSenal}
            limit={topeCop}
            tone="firma"
            size="sm"
            label="Gastado sin señal"
          />
          {d.congelado ? (
            <p className="text-xs font-medium text-grafito">
              Pausado: no puedes pagar sin señal hasta que quien te da el dinero
              lo reactive.
            </p>
          ) : (
            <p className="text-xs text-ink-2">
              De {formatCop(topeCop)}
              {d.topeMaximo &&
                A.cmp(d.topeMaximo, d.cert.offlineCap) > 0 &&
                ` · máximo ${formatCop(A.toCop(d.topeMaximo, d.fx))}: el Guardián lo sube con buen uso`}
              . Se renueva cada vez que tienes señal.
            </p>
          )}
        </div>
      </section>

      <Button
        size="xl"
        className="w-full rounded-full"
        icon={<QrCode aria-hidden="true" />}
        onClick={onPagar}
        disabled={sinSenal <= 0}
      >
        Pagar
      </Button>
      {onAsistente && (
        <Button
          size="lg"
          variant="outline"
          className="-mt-2 w-full rounded-full"
          icon={<MessageCircle aria-hidden="true" />}
          onClick={onAsistente}
        >
          Hablar con el asistente
        </Button>
      )}
      {onHistorial && (
        <Button
          size="lg"
          variant="outline"
          className="-mt-2 w-full rounded-full"
          icon={<History aria-hidden="true" />}
          onClick={onHistorial}
        >
          Mi historial
        </Button>
      )}

      {formasDePagar}

      <section aria-labelledby="tus-vales" className="space-y-2">
        <h2 id="tus-vales" className="px-1 text-base font-medium text-grafito">
          Tus vales
        </h2>
        {d.vales.length === 0 ? (
          <p className="rounded-2xl bg-paper-raised p-4 text-sm text-ink-2">
            Aún no has pagado con este celular.
          </p>
        ) : (
          <ul className="divide-y divide-rule rounded-3xl bg-paper-raised px-4">
            {d.vales.slice(0, 6).map((v) => (
              <li key={v.voucherId} className="flex items-center gap-3 py-3">
                <span className="num w-10 shrink-0 text-xs text-ink-2">
                  N.º {v.counter}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] text-grafito">
                    {v.merchantName}
                  </span>
                  <span className="cifra block text-xs text-ink-2">
                    {formatTime(v.createdAt).slice(0, 5)}
                  </span>
                </span>
                <span className="cifra text-[0.9375rem] text-grafito">
                  {formatCop(v.cop)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Solo si Juan paga en USD: en COP no hay conversión. */}
      {d.cert.offlineCap.assetCode !== 'COP' && (
        <p className="mt-auto text-center text-xs text-ink-2">
          1 USD ={' '}
          {formatCurrency(d.fx, 'COP', { maximumFractionDigits: 2 })} ·{' '}
          {etiquetaTasa(d.fxFecha)}
        </p>
      )}
      {desvincular}
    </div>
  );
};
