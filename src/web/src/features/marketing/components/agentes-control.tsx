import { Bot, Check, KeyRound, Snowflake, Undo2, X } from 'lucide-react';
import * as React from 'react';

import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/format';

import paisaje from '../assets/hero/paisaje-poster.png';
import {
  type EstadoRama,
  type Intento,
  type Periodo,
  evaluarIntentos,
  gastoAprobado,
} from '../utils/control-agente';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// "Controla cada peso que gasta tu agente" (referencia en Mobbin: los
// controles de gasto de Altitude). Cuatro mosaicos sobre el paisaje pixel; son
// interactivos: el tope, el periodo y el estado de la rama recalculan en vivo
// las compras del Asistente con la misma lógica del gateway.

const INTENTOS: Intento[] = [
  { que: 'Losartán · Farmacia San José', monto: 3, categoria: 'farmacia' },
  { que: 'Consulta al Inventario', monto: 0.01, categoria: 'datos' },
  { que: 'Insulina · Droguería La 30', monto: 22, categoria: 'farmacia' },
  { que: 'Mercado · Tienda Doña Rosa', monto: 35, categoria: 'mercado' },
  { que: 'Aguardiente · Estanco El Paisa', monto: 8, categoria: 'licor' },
];
const CATEGORIAS = ['farmacia', 'mercado', 'datos'];
const TOPES = [10, 40, 100];
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'compra', label: 'Por compra' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
];

const usd = (n: number) =>
  formatCurrency(n, 'USD', { minimumFractionDigits: n < 1 ? 2 : 0 });

// Fondo de cada mosaico: un recorte distinto del paisaje del hero
const Mosaico = ({
  encuadre,
  children,
  pie,
  titulo,
}: {
  encuadre: string;
  children: React.ReactNode;
  titulo: string;
  pie: string;
}) => (
  <article className="flex flex-col">
    <div className="relative isolate flex min-h-[19rem] items-center justify-center overflow-hidden rounded-2xl p-4">
      <img
        src={paisaje}
        alt=""
        width={640}
        height={360}
        loading="lazy"
        className={cn(
          'absolute inset-0 -z-10 h-full w-full scale-[2.2] object-cover pixelado',
          encuadre,
        )}
      />
      <div className="w-full max-w-[19rem] rounded-xl border border-paper-raised/70 bg-paper-raised/95 p-3 shadow-[0_18px_40px_-22px_rgb(10_20_40/0.6)] backdrop-blur-sm">
        {children}
      </div>
    </div>
    <h3 className="mt-4 font-geist text-[0.9375rem] font-medium text-grafito">
      {titulo}
    </h3>
    <p className="mt-1 font-geist text-[0.8125rem] leading-snug text-grafito-2">
      {pie}
    </p>
  </article>
);

const Barra = ({
  nombre,
  usado,
  tope,
  alerta,
}: {
  nombre: string;
  usado: number;
  tope: number;
  alerta?: boolean;
}) => (
  <div className="rounded-lg border border-hueso-2 bg-paper-raised px-3 py-2">
    <div className="flex items-baseline justify-between font-geist text-xs">
      <span className="text-grafito">{nombre}</span>
      <span className="num text-grafito-2">
        <span className={alerta ? 'text-anulado' : 'text-grafito'}>
          {usd(usado)}
        </span>{' '}
        / {usd(tope)}
      </span>
    </div>
    <div className="mt-2 flex gap-[2px]" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 flex-1 rounded-[1px] transition-colors duration-500',
            i < Math.round((usado / tope) * 20)
              ? alerta
                ? 'bg-anulado'
                : 'bg-liquidado'
              : 'bg-hueso-2',
          )}
        />
      ))}
    </div>
  </div>
);

export const AgentesControl = () => {
  const [tope, setTope] = React.useState(40);
  const [periodo, setPeriodo] = React.useState<Periodo>('mes');
  const [estado, setEstado] = React.useState<EstadoRama>('activa');

  const resultado = evaluarIntentos(INTENTOS, {
    tope,
    periodo,
    estado,
    categorias: CATEGORIAS,
  });
  const gastado = gastoAprobado(resultado);
  const textoPeriodo =
    periodo === 'compra'
      ? 'por compra'
      : periodo === 'semana'
        ? 'cada semana'
        : 'cada mes';

  return (
    <section aria-labelledby="agentes-title" className="bg-hueso">
      <Container className="py-16 sm:py-24">
        <Etiqueta className="justify-center">Agentes</Etiqueta>
        <TituloDosTonos
          id="agentes-title"
          centrado
          className="mt-4"
          oscuro="Controla cada peso que gasta tu agente."
          gris="Tú pones las reglas de su rama; el gateway las hace cumplir antes de cada pago."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Mosaico
            encuadre="object-[20%_55%]"
            titulo="El tope se renueva solo"
            pie={`Cada rama tiene su tope y se renueva ${textoPeriodo === 'por compra' ? 'en cada compra' : textoPeriodo}.`}
          >
            <div className="space-y-2">
              <Barra
                nombre="Asistente de Doña Rosa"
                usado={gastado}
                tope={tope}
                alerta={estado !== 'activa'}
              />
              <Barra nombre="Inventario" usado={0.21} tope={0.5} />
              <Barra nombre="Celular de María" usado={63} tope={150} />
            </div>
          </Mosaico>

          <Mosaico
            encuadre="object-[70%_20%]"
            titulo="Tú fijas el tope"
            pie="Por compra, por semana o por mes. Pruébalo: las compras de al lado cambian."
          >
            <p className="font-geist text-xs text-grafito-2">
              Rama del Asistente
            </p>
            <div
              role="radiogroup"
              aria-label="Periodo del tope"
              className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-hueso p-1"
            >
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={periodo === p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={cn(
                    'rounded-md px-2 py-1.5 font-geist text-xs transition-colors',
                    periodo === p.id
                      ? 'bg-paper-raised text-grafito shadow-sm'
                      : 'text-grafito-2 hover:text-grafito',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div
              role="radiogroup"
              aria-label="Monto del tope"
              className="mt-2 grid grid-cols-3 gap-1"
            >
              {TOPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tope === t}
                  onClick={() => setTope(t)}
                  className={cn(
                    'num rounded-md border px-2 py-2 font-geist text-sm transition-colors',
                    tope === t
                      ? 'border-firma bg-firma-tint text-firma'
                      : 'border-hueso-2 text-grafito hover:border-grafito-2',
                  )}
                >
                  {usd(t)}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 font-geist text-[0.6875rem] text-grafito-2">
              <KeyRound className="size-3" aria-hidden="true" />
              Pide PIN sobre $10 · farmacia, mercado, datos
            </p>
          </Mosaico>

          <Mosaico
            encuadre="object-[90%_95%]"
            titulo="Lo que se pasa, se rechaza al instante"
            pie="El gateway revisa cada compra del agente antes de que salga el dinero."
          >
            <ul className="space-y-1.5" aria-live="polite">
              {resultado.map(({ intento, veredicto }) => (
                <li
                  key={intento.que}
                  className="flex items-center justify-between gap-2 rounded-lg border border-hueso-2 bg-paper-raised px-2.5 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-geist text-xs text-grafito">
                      {intento.que}
                    </span>
                    <span className="num font-geist text-[0.6875rem] text-grafito-2">
                      {usd(intento.monto)}
                    </span>
                  </span>
                  {veredicto.tipo === 'aprobado' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-liquidado-tint px-2 py-0.5 font-geist text-[0.625rem] text-liquidado">
                      <Check className="size-3" aria-hidden="true" />
                      {veredicto.conPin ? 'Con PIN' : 'Pagado'}
                    </span>
                  ) : (
                    <span className="inline-flex max-w-[48%] shrink-0 items-center gap-1 rounded-full bg-anulado-tint px-2 py-0.5 text-right font-geist text-[0.625rem] leading-tight text-anulado">
                      <X className="size-3 shrink-0" aria-hidden="true" />
                      {veredicto.motivo}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Mosaico>

          <Mosaico
            encuadre="object-[45%_35%]"
            titulo="Congela o revoca en un toque"
            pie="Solo esa rama se detiene; el resto del árbol sigue pagando."
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-agente-tint text-agente">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-geist text-sm font-medium text-grafito">
                  Asistente de Doña Rosa
                </p>
                <p
                  className={cn(
                    'font-geist text-xs',
                    estado === 'activa' ? 'text-liquidado' : 'text-anulado',
                  )}
                >
                  {estado === 'activa'
                    ? 'Activa · puede pagar'
                    : estado === 'congelada'
                      ? 'Congelada · no paga'
                      : 'Revocada · no paga'}
                </p>
              </div>
            </div>
            {estado === 'activa' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEstado('congelada')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hueso-2 px-3 py-2 font-geist text-xs text-grafito transition-colors hover:bg-hueso"
                >
                  <Snowflake className="size-3.5" aria-hidden="true" />
                  Congelar
                </button>
                <button
                  type="button"
                  onClick={() => setEstado('revocada')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-anulado px-3 py-2 font-geist text-xs text-paper-raised transition-opacity hover:opacity-90"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Revocar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEstado('activa')}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-grafito px-3 py-2 font-geist text-xs text-paper-raised transition-opacity hover:opacity-90"
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
                {estado === 'congelada' ? 'Descongelar' : 'Firmar de nuevo'}
              </button>
            )}
          </Mosaico>
        </div>
      </Container>
    </section>
  );
};
