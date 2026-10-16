import { motion, useReducedMotion } from 'motion/react';

import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';

import { TituloDosTonos } from './titulo-dos-tonos';

// "Qué es real", con la forma de una página de estado (referencia en Mobbin:
// Stripe Status). La lista sale de "Qué es real vs. qué es demo" del documento
// del proyecto (docs/producto/context.md §6). Las barras se llenan al entrar a la vista.

const filas = [
  {
    nombre: 'Grant GNAP interactivo',
    nota: 'debitAmount + interval, aprobado en la Test Wallet por cada titular',
    real: true,
  },
  {
    nombre: 'Outgoing Payments',
    nota: 'en todos los flujos, de la wallet del titular a la del comercio',
    real: true,
  },
  {
    nombre: 'Cobro en pesos (COP)',
    nota: 'el comercio recibe su precio exacto; si el titular paga en dólares, con el cambio real',
    real: true,
  },
  {
    nombre: 'Micropago agente → agente',
    nota: 'el Asistente le paga al Inventario por consulta',
    real: true,
  },
  {
    nombre: 'Vales ed25519 sin señal',
    nota: 'firma en el celular, verificación offline y liquidación al reconectar',
    real: true,
  },
  {
    nombre: 'Agente Guardián',
    nota: 'reglas contra el doble gasto y tope sin señal automático',
    real: true,
  },
  {
    nombre: 'Asistente por SMS',
    nota: 'Claude con herramientas; SMS real por un Android, el PIN nunca pasa por la IA',
    real: true,
  },
  {
    nombre: 'Precios y tiendas cercanas',
    nota: 'catálogos en vivo de 7 cadenas y sucursales reales (OpenStreetMap)',
    real: true,
  },
  {
    nombre: 'Tiendas de la vereda',
    nota: 'catálogo del inventario sintético; consultarlo y comprar sí se paga',
    real: false,
  },
  {
    nombre: 'Tendero sin wallet',
    nota: 'el pago a Puntored es real; la acreditación final al tendero, simulada',
    real: false,
  },
];

const SEGMENTOS = 48;

const Barra = ({ real, i }: { real: boolean; i: number }) => {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-hidden="true" className="flex h-6 gap-[2px]">
      {Array.from({ length: SEGMENTOS }, (_, k) => (
        <motion.span
          key={k}
          className={cn(
            'flex-1 rounded-[1px]',
            real
              ? 'bg-liquidado'
              : 'bg-[repeating-linear-gradient(135deg,var(--rule-strong)_0_2px,transparent_2px_4px)]',
          )}
          initial={reduceMotion ? false : { opacity: 0, scaleY: 0.3 }}
          whileInView={{ opacity: 1, scaleY: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: i * 0.08 + k * 0.012, duration: 0.25 }}
        />
      ))}
    </div>
  );
};

export const QueEsReal = () => (
  <section aria-labelledby="real-title" className="bg-hueso">
    <Container className="max-w-5xl py-16 sm:py-24">
      <TituloDosTonos
        id="real-title"
        centrado
        oscuro="Todo lo que mueve dinero es real."
        gris="Lo simulado se ve como simulado."
      />

      <div className="mt-12 rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
        <div className="rounded-lg border border-hueso-2 bg-paper-raised p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-hueso-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-geist text-sm font-medium text-grafito">
              Red de prueba de Interledger · Open Payments
            </p>
            <p className="flex items-center gap-4 font-geist text-xs text-grafito-2">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-sm bg-liquidado"
                  aria-hidden="true"
                />{' '}
                Real · testnet
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-sm bg-[repeating-linear-gradient(135deg,var(--rule-strong)_0_2px,transparent_2px_4px)]"
                  aria-hidden="true"
                />{' '}
                Simulado
              </span>
            </p>
          </div>
          <ul className="mt-5 space-y-5">
            {filas.map((f, i) => (
              <li key={f.nombre}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <p className="font-geist text-sm font-medium text-grafito">
                    {f.nombre}
                  </p>
                  <p
                    className={cn(
                      'font-geist text-xs',
                      f.real ? 'text-liquidado' : 'text-grafito-2',
                    )}
                  >
                    {f.real ? 'Real' : 'Simulado'} ·{' '}
                    <span className="text-grafito-2">{f.nota}</span>
                  </p>
                </div>
                <Barra real={f.real} i={i} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-center font-geist text-xs text-grafito-2">
        Desplegado con Open Payments real sobre la red de prueba de Interledger.
      </p>
    </Container>
  </section>
);
