import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useNotifications } from '@/components/ui/notifications';
import { modoInfo } from '@/config/modos';
import { type Amount, type ModeView, type SpendMode } from '@/types/api';
import { cn } from '@/utils/cn';

import {
  type ModeLimit,
  type ModesResponse,
  useSetModeLimits,
} from '../api/modes';
import { money } from '../utils/mandate';

// Repartir el tope de un beneficiario entre sus modos con sliders. Todos usan
// la misma escala (el tope de la persona), así se comparan a simple vista. Cada
// slider se detiene donde se acaba lo libre y nunca baja de lo que ese modo ya
// repartió. Lo libre se recalcula al mover; nada cambia hasta guardar.

// Clases literales: Tailwind solo genera las que lee en el código.
const tono: Record<SpendMode, { relleno: string; pulgar: string }> = {
  celular: {
    relleno: 'bg-firma',
    pulgar:
      '[&::-webkit-slider-thumb]:border-firma [&::-moz-range-thumb]:border-firma',
  },
  asistente: {
    relleno: 'bg-agente',
    pulgar:
      '[&::-webkit-slider-thumb]:border-agente [&::-moz-range-thumb]:border-agente',
  },
  sms: {
    relleno: 'bg-grafito',
    pulgar:
      '[&::-webkit-slider-thumb]:border-grafito [&::-moz-range-thumb]:border-grafito',
  },
};

// Montos en unidades menores (enteros): sin errores de redondeo al sumar.
const menor = (a?: Amount) => (a ? Number(a.value) : 0);
const aMonto = (n: number, like: Amount): Amount => ({
  ...like,
  value: String(Math.round(n)),
});
const mostrar = (n: number, like: Amount) => money(n / 10 ** like.assetScale);
const pct = (n: number, total: number) =>
  total > 0 ? `${Math.max(0, Math.min(100, (n / total) * 100))}%` : '0%';

// Paso cómodo: ~1 % del total, redondeado a una potencia de 10.
const pasoPara = (total: number) =>
  Math.max(1, 10 ** Math.floor(Math.log10(Math.max(total / 100, 1))));

type Valores = Record<string, { tope: number; techo?: number }>;

const inicialesDe = (modos: ModeView[]): Valores =>
  Object.fromEntries(
    modos.map((m) => [
      m.mandateId,
      {
        tope: menor(m.maxDebit),
        techo: m.offlineCap
          ? menor(m.offlineCapCeiling ?? m.offlineCap)
          : undefined,
      },
    ]),
  );

const Pista = ({
  total,
  valor,
  alcanzable,
  gastado,
  relleno,
}: {
  total: number;
  valor: number;
  alcanzable: number;
  gastado: number;
  relleno: string;
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-[2px] border border-rule-strong bg-paper-raised"
  >
    <div
      className={cn('absolute inset-y-0 left-0 opacity-90', relleno)}
      style={{ width: pct(valor, total) }}
    />
    {/* Rayado: hasta ahí no llega con lo libre (como en la regla de consumo) */}
    {alcanzable < total && (
      <div
        className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--rule-strong)_0_2px,transparent_2px_5px)] opacity-70"
        style={{ left: pct(alcanzable, total) }}
      />
    )}
    <div className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(10%-1px),var(--rule-strong)_calc(10%-1px),var(--rule-strong)_10%)] opacity-60" />
    {/* Lo que ya gastó en el periodo */}
    {gastado > 0 && (
      <div
        className="absolute inset-y-0 w-0.5 bg-anulado"
        style={{ left: pct(gastado, total) }}
      />
    )}
  </div>
);

const Deslizador = ({
  etiqueta,
  valor,
  total,
  alcanzable,
  gastado = 0,
  paso,
  like,
  tonoModo,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  total: number;
  alcanzable: number;
  gastado?: number;
  paso: number;
  like: Amount;
  tonoModo: { relleno: string; pulgar: string };
  onChange: (n: number) => void;
}) => (
  <div className="relative h-12">
    <Pista
      total={total}
      valor={valor}
      alcanzable={alcanzable}
      gastado={gastado}
      relleno={tonoModo.relleno}
    />
    <input
      type="range"
      min={0}
      max={total}
      step={paso}
      value={valor}
      aria-label={etiqueta}
      aria-valuetext={mostrar(valor, like)}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'relative h-12 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none',
        '[&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent',
        '[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:bg-paper-raised [&::-webkit-slider-thumb]:shadow-sm',
        '[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:bg-paper-raised',
        '[&:focus-visible::-moz-range-thumb]:ring-[3px] [&:focus-visible::-moz-range-thumb]:ring-ring [&:focus-visible::-webkit-slider-thumb]:ring-[3px] [&:focus-visible::-webkit-slider-thumb]:ring-ring',
        tonoModo.pulgar,
      )}
    />
  </div>
);

const Delta = ({ n, like }: { n: number; like: Amount }) =>
  n === 0 ? null : (
    <span
      className={cn('cifra text-xs', n > 0 ? 'text-liquidado' : 'text-anulado')}
    >
      {n > 0 ? '+' : '−'}
      {mostrar(Math.abs(n), like)}
    </span>
  );

const Formulario = ({
  datos,
  onListo,
}: {
  datos: ModesResponse;
  onListo: () => void;
}) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const like = datos.budget;
  const total = menor(datos.budget) - menor(datos.reserved);
  const paso = pasoPara(total);
  const iniciales = React.useMemo(
    () => inicialesDe(datos.modes),
    [datos.modes],
  );
  const [valores, setValores] = React.useState<Valores>(iniciales);
  const guardar = useSetModeLimits({
    mutationConfig: {
      onSuccess: () => {
        addNotification({ type: 'success', title: 'Reparto guardado' });
        onListo();
      },
    },
  });

  const asignado = datos.modes.reduce(
    (acc, m) => acc + valores[m.mandateId].tope,
    0,
  );
  const libre = total - asignado;

  const mover = (m: ModeView, n: number) =>
    setValores((v) => {
      const actual = v[m.mandateId];
      // Nunca por debajo de lo que repartió, ni por encima de lo libre.
      const tope = Math.max(
        menor(m.minDebit),
        Math.min(n, actual.tope + libre),
      );
      // Si baja el celular por debajo de su techo sin señal, el techo baja con él.
      const techo =
        actual.techo === undefined ? undefined : Math.min(actual.techo, tope);
      return { ...v, [m.mandateId]: { tope, techo } };
    });

  const moverTecho = (m: ModeView, n: number) =>
    setValores((v) => ({
      ...v,
      [m.mandateId]: {
        ...v[m.mandateId],
        techo: Math.min(n, v[m.mandateId].tope),
      },
    }));

  const cambios: ModeLimit[] = datos.modes.flatMap((m) => {
    const ahora = valores[m.mandateId];
    const antes = iniciales[m.mandateId];
    const cambia: ModeLimit = { mandateId: m.mandateId };
    if (ahora.tope !== antes.tope)
      cambia.maxDebit = aMonto(ahora.tope, m.maxDebit);
    if (ahora.techo !== undefined && ahora.techo !== antes.techo)
      cambia.offlineCap = aMonto(ahora.techo, m.maxDebit);
    return cambia.maxDebit || cambia.offlineCap ? [cambia] : [];
  });

  return (
    <>
      <section
        aria-label="Reparto"
        className="sticky -top-6 z-10 space-y-3 rounded-sm border border-rule bg-paper p-4 shadow-[0_8px_16px_-12px_rgb(28_34_48/0.35)]"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-2">Libre para asignar</p>
            <p
              aria-live="polite"
              className={cn(
                'cifra text-3xl leading-none font-light tracking-[-0.02em]',
                libre === 0 ? 'text-ink-2' : 'text-grafito',
              )}
            >
              {mostrar(libre, like)}
            </p>
          </div>
          <p className="cifra text-right text-xs text-ink-2">
            de {mostrar(menor(datos.budget), like)}
            {menor(datos.reserved) > 0 &&
              ` · ${mostrar(menor(datos.reserved), like)} en otras ramas`}
          </p>
        </div>
        {/* El tope de la persona repartido: un tramo por modo y lo libre */}
        <div
          aria-hidden="true"
          className="flex h-3 w-full overflow-hidden rounded-[2px] border border-rule-strong"
        >
          {datos.modes.map((m) => (
            <div
              key={m.mandateId}
              className={cn(
                'h-full transition-[width] duration-150 motion-reduce:transition-none',
                tono[m.mode].relleno,
              )}
              style={{
                width: pct(valores[m.mandateId].tope, menor(datos.budget)),
              }}
            />
          ))}
          <div
            className="h-full bg-ink-3"
            style={{
              width: pct(menor(datos.reserved), menor(datos.budget)),
            }}
          />
          <div className="h-full flex-1 bg-paper-raised" />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {datos.modes.map((m) => (
            <li key={m.mandateId} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', tono[m.mode].relleno)}
              />
              {modoInfo[m.mode].nombre}
            </li>
          ))}
          {menor(datos.reserved) > 0 && (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-ink-3"
              />
              Otras ramas
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full border border-dashed border-rule-strong bg-paper-raised"
            />
            Libre
          </li>
        </ul>
      </section>

      <ul className="space-y-5">
        {datos.modes.map((m) => {
          const v = valores[m.mandateId];
          const antes = iniciales[m.mandateId];
          const minimo = menor(m.minDebit);
          return (
            <li key={m.mandateId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.9375rem] font-medium text-grafito">
                  {modoInfo[m.mode].nombre}
                </span>
                <span className="flex items-baseline gap-2">
                  <Delta n={v.tope - antes.tope} like={like} />
                  <span className="cifra text-lg text-grafito">
                    {mostrar(v.tope, like)}
                  </span>
                </span>
              </div>
              <Deslizador
                etiqueta={`Tope de ${modoInfo[m.mode].nombre}`}
                valor={v.tope}
                total={total}
                alcanzable={v.tope + libre}
                gastado={menor(m.spent)}
                paso={paso}
                like={like}
                tonoModo={tono[m.mode]}
                onChange={(n) => mover(m, n)}
              />
              <p className="cifra flex justify-between gap-3 text-xs text-ink-2">
                <span>
                  {minimo > 0
                    ? `mín. ${mostrar(minimo, like)}`
                    : menor(m.spent) > 0
                      ? `gastó ${mostrar(menor(m.spent), like)}`
                      : 'sin gasto este periodo'}
                </span>
                <span>puede subir hasta {mostrar(v.tope + libre, like)}</span>
              </p>
              {v.techo !== undefined && (
                <div className="mt-4 space-y-1 border-l-2 border-dashed border-rule-strong pl-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-grafito">
                      Techo sin señal
                    </span>
                    <span className="cifra text-sm text-grafito">
                      {mostrar(v.techo, like)}
                    </span>
                  </div>
                  <Deslizador
                    etiqueta="Techo sin señal del celular"
                    valor={v.techo}
                    total={total}
                    alcanzable={v.tope}
                    paso={paso}
                    like={like}
                    tonoModo={tono.celular}
                    onChange={(n) => moverTecho(m, n)}
                  />
                  <p className="text-xs text-ink-2">
                    Lo máximo que aceptas perder sin señal. Nunca supera el tope
                    del celular; el Guardián se mueve por debajo.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {guardar.isError && (
        <p role="alert" className="text-sm text-anulado">
          No se guardó el reparto. Nada cambió.
        </p>
      )}

      <DialogFooter className="sticky -bottom-6 z-10 -mx-6 -mb-6 items-center border-t border-rule bg-paper-raised px-6 py-4 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<RotateCcw aria-hidden="true" />}
          disabled={cambios.length === 0}
          onClick={() => setValores(iniciales)}
        >
          Restablecer
        </Button>
        <Button
          type="button"
          isLoading={guardar.isPending}
          disabled={cambios.length === 0}
          onClick={() =>
            guardar.mutate({ personaId: datos.personaId, limits: cambios })
          }
        >
          Guardar reparto
        </Button>
      </DialogFooter>
    </>
  );
};

export const RepartirModos = ({ datos }: { datos: ModesResponse }) => {
  const [abierto, setAbierto] = React.useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          icon={<SlidersHorizontal aria-hidden="true" />}
        >
          Ajustar topes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Repartir el tope de {datos.personaName}</DialogTitle>
          <DialogDescription>
            Mueve cada forma de pagar; lo libre se recalcula al instante. Nada
            cambia hasta que guardes.
          </DialogDescription>
        </DialogHeader>
        {/* Se monta al abrir: arranca siempre con los topes guardados */}
        {abierto && (
          <Formulario datos={datos} onListo={() => setAbierto(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
};
