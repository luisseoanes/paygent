import { amount as A, type Merchant, type Voucher } from '@openroute/shared';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { formatCop, formatCurrency } from '@/utils/format';

import {
  type Dispositivo,
  useDispositivoStore,
} from '../stores/dispositivo-store';
import {
  comerciosPermitidos,
  crearVale,
  disponibleSinSenalCop,
} from '../utils/vale';

import { ComercioIcono } from './comercio-icono';
import { TecladoMonto } from './teclado-monto';

// Pagar en dos pasos: ¿dónde? y ¿cuánto? Luego se firma el vale en el
// celular (sin red) y se muestra como QR.

const Volver = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="-ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 text-sm text-ink-2 hover:text-grafito"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    {label}
  </button>
);

export const Pagar = ({
  dispositivo: d,
  onCancelar,
  onVale,
}: {
  dispositivo: Dispositivo;
  onCancelar: () => void;
  onVale: (voucher: Voucher, merchant: Merchant, cop: number) => void;
}) => {
  const guardar = useDispositivoStore((s) => s.guardar);
  const [comercio, setComercio] = React.useState<Merchant>();
  const [cop, setCop] = React.useState(0);
  const [error, setError] = React.useState<string>();
  const disponible = disponibleSinSenalCop(d);
  const comercios = comerciosPermitidos(d);

  if (!comercio)
    return (
      <div className="flex flex-1 flex-col gap-4 pt-2">
        <Volver onClick={onCancelar} label="Inicio" />
        <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em] text-grafito">
          ¿Dónde vas a pagar?
        </h1>
        <ul className="space-y-2">
          {comercios.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setComercio(m)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-paper-raised px-4 py-3 text-left transition-colors hover:bg-hueso-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ComercioIcono category={m.category} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-grafito">
                    {m.name}
                  </span>
                  <span className="block text-xs text-ink-2 capitalize">
                    {m.category}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-ink-2"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  const enRaiz = A.fromCop(cop, A.assetOf(d.cert.offlineCap), d.fx);
  const excede = cop > disponible;

  const generar = async () => {
    const r = crearVale(d, comercio, cop);
    if (!r.ok) return setError(r.motivo);
    await guardar(r.siguiente);
    onVale(r.voucher, comercio, cop);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <Volver onClick={() => setComercio(undefined)} label="Cambiar comercio" />
      <div className="flex items-center gap-3">
        <ComercioIcono category={comercio.category} />
        <p className="text-[0.9375rem] font-medium text-grafito">
          {comercio.name}
        </p>
      </div>

      <div className="py-2 text-center">
        <p
          aria-live="polite"
          className="cifra text-[3.25rem] leading-none font-light tracking-[-0.03em] text-grafito"
        >
          {formatCop(cop)}
        </p>
        {enRaiz.assetCode !== 'COP' && (
          <p className="mt-2 text-xs text-ink-2">
            ≈{' '}
            {formatCurrency(A.toNumber(enRaiz), enRaiz.assetCode, {
              currencyDisplay: 'code',
            })}{' '}
            · tasa de referencia
          </p>
        )}
        <p
          className={
            excede ? 'mt-1 text-sm text-anulado' : 'mt-1 text-sm text-ink-2'
          }
        >
          {excede
            ? `Sin señal solo te quedan ${formatCop(disponible)}`
            : `Sin señal te quedan ${formatCop(disponible)}`}
        </p>
      </div>

      <TecladoMonto
        value={cop}
        onChange={(n) => {
          setError(undefined);
          setCop(n);
        }}
      />

      {error && (
        <p role="alert" className="text-center text-sm text-anulado">
          {error}
        </p>
      )}

      <Button
        size="xl"
        className="w-full rounded-full"
        disabled={cop <= 0 || excede}
        onClick={generar}
      >
        Generar vale
      </Button>
    </div>
  );
};
