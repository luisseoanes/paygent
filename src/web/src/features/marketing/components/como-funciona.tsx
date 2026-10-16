import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'motion/react';
import * as React from 'react';

import { ReglaDeConsumo } from '@/components/brand/regla-consumo';
import { Sello } from '@/components/brand/sello';
import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/format';

import { createDemoTree } from '../utils/demo-data';
import { applyDebit } from '../utils/rules';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// "Cómo funciona", fijada al scroll (referencias en Mobbin: la línea de pasos
// de Giga y el flujo pixel de Wild). A la izquierda, cuatro pasos; a la
// derecha, el árbol del mandato se construye según el paso. Los números salen
// de las reglas reales del gateway: applyDebit debita la rama Y la raíz, así
// que en el paso 3 las dos reglas suben juntas.

const PAGO = 3; // losartán: 12.000 COP ≈ $3 USD
const antes = createDemoTree();
const despues = applyDebit(antes, 'asistente', PAGO);

const pasos = [
  {
    titulo: 'Firmas una vez',
    texto:
      'El titular aprueba en su billetera un permiso de Open Payments con tope y renovación: $300 al mes.',
  },
  {
    titulo: 'Se reparte en ramas',
    texto:
      'El gateway lo divide en sub-mandatos firmados. Ninguna rama puede gastar más que la de arriba.',
  },
  {
    titulo: 'Cada quien paga',
    texto:
      'El agente compra la medicina dentro de su rama. El pago descuenta su tope y el de la raíz a la vez.',
  },
  {
    titulo: 'Llega directo',
    texto:
      'Un Outgoing Payment va de la wallet del titular a la farmacia. Nadie en medio retiene el dinero.',
  },
];

const ramas = [
  { id: 'maria', nombre: 'Familiar', x: 18, tono: 'firma' as const },
  {
    id: 'asistente',
    nombre: 'Agente de compras',
    x: 50,
    tono: 'agente' as const,
  },
  { id: 'guardian', nombre: 'Guardián', x: 82, tono: 'anulado' as const },
];

const Arbol = ({ paso }: { paso: number }) => {
  const reduceMotion = useReducedMotion();
  const arbol = paso >= 2 ? despues : antes;
  const raiz = arbol.root!;
  const t = reduceMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.3, 0.7, 0.2, 1] as const };

  return (
    <div className="relative aspect-[5/4] w-full rounded-lg border border-hueso-2 bg-hueso/60 bg-[radial-gradient(circle,var(--hueso-2)_1px,transparent_1.5px)] bg-[length:18px_18px]">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 80"
        className="absolute inset-0 h-full w-full"
      >
        {ramas.map((r) => (
          <motion.path
            key={r.id}
            d={`M50 30 V40 H${r.x} V52`}
            fill="none"
            stroke={
              r.id === 'asistente' && paso >= 2
                ? 'var(--firma)'
                : 'var(--rule-strong)'
            }
            strokeWidth={r.id === 'asistente' && paso >= 2 ? 0.9 : 0.4}
            strokeDasharray={r.id === 'guardian' ? '1 1' : undefined}
            initial={false}
            animate={{
              pathLength: paso >= 1 ? 1 : 0,
              opacity: paso >= 1 ? 1 : 0,
            }}
            transition={t}
          />
        ))}
        <motion.path
          d="M50 70 V77"
          fill="none"
          stroke="var(--liquidado)"
          strokeWidth={0.9}
          initial={false}
          animate={{
            pathLength: paso >= 3 ? 1 : 0,
            opacity: paso >= 3 ? 1 : 0,
          }}
          transition={t}
        />
      </svg>

      {/* Raíz */}
      <div className="absolute top-[8%] left-1/2 w-[46%] -translate-x-1/2 rounded-md border border-hueso-2 bg-paper-raised p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-geist text-xs font-medium text-grafito">
            Mandato raíz
          </p>
          <p className="num text-xs text-grafito">$300 / mes</p>
        </div>
        <ReglaDeConsumo
          spent={raiz.spent}
          limit={raiz.limit}
          size="sm"
          className="mt-2"
          label="Consumo del mandato raíz"
        />
        <p className="num mt-1 text-[0.625rem] text-grafito-2">
          gastado{' '}
          {formatCurrency(raiz.spent, 'USD', { minimumFractionDigits: 2 })}
        </p>
        <motion.span
          className="absolute -top-9 -right-12"
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Sello variant="autorizado" size="sm" seed="raiz" />
        </motion.span>
      </div>

      {/* Ramas */}
      {ramas.map((r, i) => {
        const nodo = arbol[r.id]!;
        return (
          <motion.div
            key={r.id}
            className="absolute top-[64%] w-[28%] -translate-x-1/2 rounded-md border border-hueso-2 bg-paper-raised p-2.5 shadow-sm"
            style={{ left: `${r.x}%` }}
            initial={false}
            animate={{ opacity: paso >= 1 ? 1 : 0, y: paso >= 1 ? 0 : 10 }}
            transition={{ ...t, delay: reduceMotion ? 0 : i * 0.08 }}
          >
            <p
              className={cn(
                'truncate font-geist text-[0.6875rem] font-medium',
                r.tono === 'agente' && 'text-agente',
                r.tono === 'anulado' && 'text-anulado',
                r.tono === 'firma' && 'text-grafito',
              )}
            >
              {r.nombre}
            </p>
            <p className="num text-[0.625rem] text-grafito-2">
              {r.id === 'guardian'
                ? '$0 · solo restringe'
                : `tope ${formatCurrency(nodo.limit)}`}
            </p>
            {r.id !== 'guardian' && (
              <ReglaDeConsumo
                spent={nodo.spent}
                limit={nodo.limit}
                size="sm"
                tone={r.tono === 'agente' ? 'agente' : 'firma'}
                className="mt-1.5"
                label={`Consumo de ${r.nombre}`}
              />
            )}
            {r.id === 'asistente' && paso >= 3 && (
              <span className="absolute -top-5 -right-4">
                <Sello variant="liquidado" size="sm" seed="pago" />
              </span>
            )}
          </motion.div>
        );
      })}

      {/* Destino */}
      <motion.p
        className="absolute bottom-[1%] left-1/2 -translate-x-1/2 rounded-full border border-liquidado/40 bg-liquidado-tint px-3 py-1 font-geist text-[0.6875rem] whitespace-nowrap text-liquidado"
        initial={false}
        animate={{ opacity: paso >= 3 ? 1 : 0, y: paso >= 3 ? 0 : 6 }}
        transition={t}
      >
        Farmacia San José ·{' '}
        {formatCurrency(PAGO, 'USD', { minimumFractionDigits: 2 })} · Outgoing
        Payment completed
      </motion.p>
    </div>
  );
};

export const ComoFunciona = () => {
  const ref = React.useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [paso, setPaso] = React.useState(reduceMotion ? 3 : 0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduceMotion) return;
    setPaso(Math.min(3, Math.max(0, Math.floor(v * 4))));
  });

  return (
    <section
      ref={ref}
      aria-labelledby="como-title"
      className="relative bg-hueso lg:h-[340vh]"
    >
      <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:items-center">
        <Container className="max-w-6xl py-16 sm:py-24 lg:py-0">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-5">
              <Etiqueta>Cómo funciona</Etiqueta>
              <TituloDosTonos
                id="como-title"
                className="mt-3"
                oscuro="Un permiso que se ramifica."
                gris="Firmado una vez, gastado por muchos."
              />
              <ol className="mt-8 space-y-1">
                {pasos.map((p, i) => {
                  const activo = paso === i;
                  return (
                    <li key={p.titulo}>
                      <button
                        type="button"
                        onClick={() => setPaso(i)}
                        aria-current={activo ? 'step' : undefined}
                        className={cn(
                          'relative w-full rounded-lg py-3 pr-3 pl-10 text-left transition-colors',
                          activo
                            ? 'bg-paper-raised shadow-sm'
                            : 'hover:bg-paper-raised/50',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-3.5 left-3 flex size-5 items-center justify-center rounded-full font-mono text-[0.625rem]',
                            paso >= i
                              ? 'bg-grafito text-hueso'
                              : 'border border-rule-strong text-grafito-2',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span
                          className={cn(
                            'block font-geist text-[0.9375rem] font-medium',
                            activo ? 'text-grafito' : 'text-grafito-2',
                          )}
                        >
                          {p.titulo}
                        </span>
                        {activo && (
                          <motion.span
                            initial={
                              reduceMotion ? false : { opacity: 0, height: 0 }
                            }
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-1 block font-geist text-sm leading-relaxed text-grafito-2"
                          >
                            {p.texto}
                          </motion.span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {/* Progreso continuo (Giga) */}
              <div className="mt-6 hidden h-1 overflow-hidden rounded-full bg-hueso-2 lg:block">
                <motion.div
                  className="h-full origin-left bg-firma"
                  style={{ scaleX: scrollYProgress }}
                />
              </div>
            </div>

            <figure className="lg:col-span-7">
              <div className="rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
                <Arbol paso={paso} />
              </div>
              <figcaption className="mt-3 text-center font-geist text-xs text-grafito-2">
                Los números salen de las reglas reales del gateway: la rama y la
                raíz se debitan juntas.
              </figcaption>
            </figure>
          </div>
        </Container>
      </div>
    </section>
  );
};
