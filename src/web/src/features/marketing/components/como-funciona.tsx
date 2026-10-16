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

// Conector del árbol. Va en el flujo del layout (no en un SVG aparte), así
// que siempre toca las tarjetas; todas las líneas tienen el mismo grosor.
const Linea = ({
  eje,
  visible,
  activo,
  color = 'var(--firma)',
  discontinua,
  delay = 0,
  left,
  className,
}: {
  eje: 'x' | 'y';
  visible: boolean;
  activo?: boolean;
  color?: string;
  discontinua?: boolean;
  delay?: number;
  left?: string;
  className?: string;
}) => {
  const reduceMotion = useReducedMotion();
  const tono = activo ? color : 'var(--rule-strong)';
  return (
    <motion.span
      aria-hidden="true"
      className={cn(
        'absolute',
        eje === 'y'
          ? 'top-0 bottom-0 w-[3px] origin-top -translate-x-1/2'
          : 'top-0 h-[3px] origin-center',
        className,
      )}
      style={{
        left,
        background: discontinua
          ? `repeating-linear-gradient(${eje === 'y' ? 'to bottom' : 'to right'}, ${tono} 0 6px, transparent 6px 11px)`
          : tono,
      }}
      initial={false}
      animate={
        eje === 'y' ? { scaleY: visible ? 1 : 0 } : { scaleX: visible ? 1 : 0 }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.5, delay, ease: [0.3, 0.7, 0.2, 1] }
      }
    >
      {/* Pulso: el dinero viajando por el camino activo */}
      {activo && visible && eje === 'y' && !reduceMotion && (
        <motion.span
          className="absolute left-1/2 size-3 -translate-x-1/2 rounded-full ring-4 ring-paper-raised"
          style={{ background: color }}
          initial={{ top: '-10%', opacity: 0 }}
          animate={{ top: ['-10%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: 'easeIn',
            delay: delay + 0.4,
          }}
        />
      )}
    </motion.span>
  );
};

// Centros de las tres columnas (grid sin gap: cada columna mide 1/3).
const CENTROS = ['16.6667%', '50%', '83.3333%'];

const Arbol = ({ paso }: { paso: number }) => {
  const reduceMotion = useReducedMotion();
  const arbol = paso >= 2 ? despues : antes;
  const raiz = arbol.root!;
  const t = reduceMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.3, 0.7, 0.2, 1] as const };
  const ramasVisibles = paso >= 1;
  const pagando = paso >= 2;
  const llego = paso >= 3;

  return (
    <div className="relative flex w-full flex-col items-center rounded-lg border border-hueso-2 bg-hueso/60 bg-[radial-gradient(circle,var(--hueso-2)_1px,transparent_1.5px)] bg-[length:18px_18px] px-3 py-10 sm:px-8 sm:py-14">
      {/* Raíz */}
      <motion.div
        className="relative w-full max-w-[26rem] rounded-xl border border-hueso-2 bg-paper-raised p-5 shadow-sm"
        animate={
          pagando && !reduceMotion
            ? {
                boxShadow: [
                  '0 0 0 0 rgb(37 64 186 / 0.25)',
                  '0 0 0 10px rgb(37 64 186 / 0)',
                ],
              }
            : undefined
        }
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-geist text-base font-semibold text-grafito">
            Mandato raíz
          </p>
          <p className="font-geist text-base font-semibold text-grafito tabular-nums">
            $300 / mes
          </p>
        </div>
        <ReglaDeConsumo
          spent={raiz.spent}
          limit={raiz.limit}
          size="md"
          className="mt-3"
          label="Consumo del mandato raíz"
        />
        <p className="mt-2 font-geist text-sm text-grafito/75 tabular-nums">
          Gastado{' '}
          <span className="font-semibold text-grafito">
            {formatCurrency(raiz.spent, 'USD', { minimumFractionDigits: 2 })}
          </span>
        </p>
        <span className="absolute -top-8 -right-8">
          <Sello variant="autorizado" size="sm" seed="raiz" />
        </span>
      </motion.div>

      {/* Tronco + barra que reparte en tres ramas */}
      <div className="relative h-12 w-full">
        <Linea
          eje="y"
          visible={ramasVisibles}
          activo={pagando}
          className="left-1/2"
        />
      </div>
      <div className="relative h-14 w-full">
        <Linea
          eje="x"
          visible={ramasVisibles}
          delay={0.2}
          className="right-[calc(16.6667%-1.5px)] left-[calc(16.6667%-1.5px)]"
        />
        {ramas.map((r, i) => (
          <Linea
            key={r.id}
            eje="y"
            left={CENTROS[i]}
            visible={ramasVisibles}
            activo={pagando && r.id === 'asistente'}
            discontinua={r.id === 'guardian'}
            delay={0.35}
          />
        ))}
      </div>

      {/* Ramas */}
      <div className="grid w-full grid-cols-3">
        {ramas.map((r, i) => {
          const nodo = arbol[r.id]!;
          const esAgente = r.id === 'asistente';
          return (
            <div key={r.id} className="px-1.5 sm:px-2">
              <motion.div
                className={cn(
                  'relative h-full rounded-lg border bg-paper-raised p-3 shadow-sm sm:p-5',
                  esAgente && pagando ? 'border-agente/50' : 'border-hueso-2',
                )}
                initial={false}
                animate={{
                  opacity: ramasVisibles ? 1 : 0,
                  y: ramasVisibles ? 0 : 12,
                  scale: esAgente && pagando && !llego ? 1.04 : 1,
                }}
                transition={{ ...t, delay: reduceMotion ? 0 : 0.4 + i * 0.08 }}
              >
                <p
                  className={cn(
                    'font-geist text-sm leading-tight font-semibold sm:text-base',
                    r.tono === 'agente' && 'text-agente',
                    r.tono === 'anulado' && 'text-anulado',
                    r.tono === 'firma' && 'text-grafito',
                  )}
                >
                  {r.nombre}
                </p>
                <p className="mt-1 font-geist text-[0.8125rem] text-grafito/75 tabular-nums sm:text-sm">
                  {r.id === 'guardian' ? (
                    'Solo restringe'
                  ) : (
                    <>
                      Tope{' '}
                      <span className="font-semibold text-grafito">
                        {formatCurrency(nodo.limit)}
                      </span>
                    </>
                  )}
                </p>
                {r.id !== 'guardian' && (
                  <ReglaDeConsumo
                    spent={nodo.spent}
                    limit={nodo.limit}
                    size="sm"
                    tone={r.tono === 'agente' ? 'agente' : 'firma'}
                    className="mt-2.5"
                    label={`Consumo de ${r.nombre}`}
                  />
                )}
                {esAgente && llego && (
                  <motion.span
                    className="absolute -top-7 -right-5"
                    initial={
                      reduceMotion
                        ? false
                        : { scale: 1.6, opacity: 0, rotate: -12 }
                    }
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                  >
                    <Sello variant="liquidado" size="sm" seed="pago" />
                  </motion.span>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Del agente a la farmacia */}
      <div className="relative h-14 w-full">
        <Linea
          eje="y"
          visible={llego}
          activo
          color="var(--liquidado)"
          className="left-1/2"
        />
      </div>
      <motion.p
        className="rounded-full border border-liquidado/40 bg-liquidado-tint px-4 py-2 text-center font-geist text-sm font-medium text-liquidado"
        initial={false}
        animate={{ opacity: llego ? 1 : 0, y: llego ? 0 : 8 }}
        transition={{ ...t, delay: reduceMotion ? 0 : 0.3 }}
      >
        Farmacia San José ·{' '}
        {formatCurrency(PAGO, 'USD', { minimumFractionDigits: 2 })} · pago
        completado
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
        <Container className="max-w-[90rem] py-16 sm:py-24 lg:py-0">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-4">
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

            <figure className="lg:col-span-8">
              <div className="rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
                <Arbol paso={paso} />
              </div>
              <figcaption className="mt-3 text-center font-geist text-sm text-grafito/75">
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
