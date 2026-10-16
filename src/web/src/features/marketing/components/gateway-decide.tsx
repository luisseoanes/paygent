import { Bot, Check, Hand, ShieldCheck, X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';
import * as React from 'react';

import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/format';

import { type Category } from '../types/paygent';
import { createDemoTree } from '../utils/demo-data';
import { canSpend } from '../utils/rules';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// "El gateway decide" (referencias en Mobbin: los agentes en vivo de Zaro y
// el motor de políticas de Overmind). Una cinta de solicitudes de agentes
// pasa por el gateway; cada veredicto se calcula con canSpend, la misma regla
// que usa la app. No hay textos fijos de "aprobado/rechazado".

type Solicitud = {
  agente: string;
  nodo: string;
  que: string;
  monto: number;
  categoria: Category;
  porSms?: boolean;
};

const solicitudes: Solicitud[] = [
  {
    agente: 'Agente de compras',
    nodo: 'asistente',
    que: 'Losartán 50 mg',
    monto: 3,
    categoria: 'farmacia',
    porSms: true,
  },
  {
    agente: 'Agente de inventario',
    nodo: 'inventario',
    que: 'Consulta de precios',
    monto: 0.01,
    categoria: 'consulta',
  },
  {
    agente: 'Agente de compras',
    nodo: 'asistente',
    que: 'Televisor 50"',
    monto: 250,
    categoria: 'mercado',
  },
  {
    agente: 'Agente de compras',
    nodo: 'asistente',
    que: 'Retiro de efectivo',
    monto: 10,
    categoria: 'efectivo',
  },
  {
    agente: 'Agente Guardián',
    nodo: 'guardian',
    que: 'Intenta pagar algo',
    monto: 1,
    categoria: 'mercado',
  },
  {
    agente: 'Agente de compras',
    nodo: 'asistente',
    que: 'Arroz y panela',
    monto: 6.5,
    categoria: 'mercado',
    porSms: true,
  },
];

type Veredicto = { tipo: 'ok' | 'pin' | 'no'; texto: string };

const arbol = createDemoTree();

const decidir = (s: Solicitud): Veredicto => {
  const r = canSpend(arbol, s.nodo, s.monto, s.categoria);
  if (!r.ok) return { tipo: 'no', texto: r.reason };
  if (s.porSms && arbol[s.nodo]?.pinRequired)
    return { tipo: 'pin', texto: 'Dentro del tope · pide el PIN a la persona' };
  return { tipo: 'ok', texto: 'Dentro del tope · Outgoing Payment' };
};

const reglas = [
  ['Un agente es una hoja del árbol', 'Nunca gasta más que su sub-mandato.'],
  ['Monotonía', 'Ningún agente puede ampliar un permiso, solo restringirlo.'],
  ['Humano en el bucle', 'Por SMS, la compra se confirma con PIN.'],
  ['No custodial', 'El dinero va de la wallet del titular al comercio.'],
  ['Trazabilidad', 'Cada acción queda con su porqué y se puede revocar.'],
];

const estilo = {
  ok: {
    icon: Check,
    clase: 'border-liquidado/40 bg-liquidado-tint text-liquidado',
    label: 'Ejecutado',
  },
  pin: {
    icon: Hand,
    clase: 'border-pendiente-borde bg-pendiente-tint text-pendiente',
    label: 'Pide PIN',
  },
  no: {
    icon: X,
    clase: 'border-anulado/40 bg-anulado-tint text-anulado',
    label: 'Bloqueado',
  },
};

const Fila = ({ s }: { s: Solicitud }) => {
  const reduceMotion = useReducedMotion();
  const v = decidir(s);
  const e = estilo[v.tipo];
  const Icon = e.icon;
  return (
    <motion.li
      layout
      initial={reduceMotion ? false : { opacity: 0, y: -18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.2 } }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-center gap-3 rounded-lg border border-hueso-2 bg-paper-raised p-3 shadow-sm"
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          s.nodo === 'guardian'
            ? 'bg-anulado-tint text-anulado'
            : 'bg-agente-tint text-agente',
        )}
      >
        {s.nodo === 'guardian' ? (
          <ShieldCheck className="size-4" aria-hidden="true" />
        ) : (
          <Bot className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-geist text-sm text-grafito">
          {s.que}{' '}
          <span className="num text-grafito-2">
            · {formatCurrency(s.monto, 'USD', { minimumFractionDigits: 2 })}
          </span>
        </span>
        <span className="block truncate font-geist text-xs text-grafito-2">
          {s.agente} · {v.texto}
        </span>
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-geist text-[0.6875rem] font-medium',
          e.clase,
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {e.label}
      </span>
    </motion.li>
  );
};

export const GatewayDecide = () => {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { amount: 0.3 });
  const [n, setN] = React.useState(reduceMotion ? 4 : 1);

  React.useEffect(() => {
    if (reduceMotion || !enVista) return;
    const id = setInterval(() => setN((v) => v + 1), 1700);
    return () => clearInterval(id);
  }, [enVista, reduceMotion]);

  // Últimas 4 solicitudes, la más nueva arriba.
  const visibles = Array.from({ length: Math.min(4, n) }, (_, k) => {
    const idx = n - 1 - k;
    return { key: idx, s: solicitudes[idx % solicitudes.length]! };
  });

  return (
    <section aria-labelledby="gateway-title" className="bg-hueso">
      <Container className="max-w-6xl py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <Etiqueta>Agentes con límites</Etiqueta>
            <TituloDosTonos
              id="gateway-title"
              className="mt-3"
              oscuro="Los agentes proponen."
              gris="El gateway decide."
            />
            <ol className="mt-8 space-y-3">
              {reglas.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-xs text-grafito-2">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block font-geist text-[0.9375rem] font-medium text-grafito">
                      {t}
                    </span>
                    <span className="block font-geist text-sm text-grafito-2">
                      {d}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div ref={ref} className="lg:col-span-7">
            <div className="rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
              <div className="rounded-lg border border-hueso-2 bg-hueso/60 p-4">
                <div className="mb-4 flex items-center justify-between font-geist text-xs text-grafito-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="pulso size-1.5 rounded-full bg-liquidado"
                      aria-hidden="true"
                    />
                    Mandate Gateway · en vivo
                  </span>
                  <span className="num">reglas: canSpend()</span>
                </div>
                <ul
                  aria-live="off"
                  className="flex min-h-[19rem] flex-col gap-2"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibles.map(({ key, s }) => (
                      <Fila key={key} s={s} />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-center font-geist text-xs text-grafito-2">
              El modelo propone; el gateway aplica el tope, la categoría y el
              PIN; la billetera del titular fija el máximo.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
};
