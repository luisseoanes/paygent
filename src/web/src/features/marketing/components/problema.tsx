import { Check, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';

import cielo from '../assets/paisaje-cielo.png';
import nubes from '../assets/rama-nubes.png';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// El problema, con la estructura "Before / With" de Zaro (Mobbin): los tres
// supuestos que Open Payments hace hoy, y cómo Paygent quita cada uno.
// Al entrar a la vista, cada supuesto se tacha y su respuesta aparece al lado.

const antes = [
  { tema: 'Pagar', texto: 'Cada pago exige estar en línea.' },
  { tema: 'Consentir', texto: 'Solo con un navegador y una redirección web.' },
  { tema: 'Billetera', texto: 'Solo paga quien tiene la suya propia.' },
];

const con = [
  {
    tema: 'Sin señal',
    texto: 'El celular firma un vale y se cobra al volver la conexión.',
  },
  {
    tema: 'Por SMS',
    texto: 'Un agente hace la compra y la persona confirma con su PIN.',
  },
  {
    tema: 'Delegado',
    texto: 'Un solo permiso se reparte entre personas y agentes.',
  },
];

const Tarjeta = ({
  tema,
  texto,
  tipo,
  i,
}: {
  tema: string;
  texto: string;
  tipo: 'antes' | 'con';
  i: number;
}) => {
  const reduceMotion = useReducedMotion();
  const Icon = tipo === 'antes' ? X : Check;
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{
        delay: (tipo === 'con' ? 0.5 : 0) + i * 0.25,
        duration: 0.45,
      }}
      className="relative rounded-md bg-paper-raised px-4 py-3 shadow-sm"
    >
      <p className="flex items-center gap-1.5 font-geist text-[0.6875rem] text-grafito-2">
        <Icon
          className={cn(
            'size-3.5',
            tipo === 'antes' ? 'text-anulado' : 'text-liquidado',
          )}
          aria-hidden="true"
        />
        {tema}
      </p>
      <p className="relative mt-1 inline-block font-geist text-[0.9375rem] text-grafito">
        {texto}
        {tipo === 'antes' && (
          <motion.span
            aria-hidden="true"
            className="absolute top-1/2 left-0 h-px w-full origin-left bg-anulado/70"
            initial={reduceMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.35 + i * 0.25, duration: 0.4 }}
          />
        )}
      </p>
    </motion.li>
  );
};

export const Problema = () => (
  <section aria-labelledby="problema-title" className="bg-hueso">
    <Container className="max-w-6xl py-16 sm:py-24">
      <TituloDosTonos
        id="problema-title"
        centrado
        oscuro="El problema no es el dinero."
        gris="Es que pagar exige internet, smartphone y billetera propia."
      />

      <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-6">
        <div>
          <Etiqueta>Antes</Etiqueta>
          <p className="mt-3 font-geist text-2xl leading-tight tracking-[-0.02em] text-grafito-2">
            Open Payments da por hecho tres cosas que en la vereda no existen.
          </p>
          <div className="relative mt-6 overflow-hidden rounded-xl">
            <img
              src={nubes}
              alt=""
              width={96}
              height={72}
              className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale pixelado"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-hueso-2/70"
            />
            <ul className="relative space-y-2.5 p-6 sm:p-10">
              {antes.map((a, i) => (
                <Tarjeta key={a.tema} {...a} tipo="antes" i={i} />
              ))}
            </ul>
          </div>
        </div>

        <div>
          <Etiqueta className="text-grafito">Con Paygent</Etiqueta>
          <p className="mt-3 font-geist text-2xl leading-tight tracking-[-0.02em] text-grafito">
            Una sola primitiva quita los tres, el mandato delegable.
          </p>
          <div className="relative mt-6 overflow-hidden rounded-xl">
            <img
              src={cielo}
              alt=""
              width={320}
              height={180}
              className="absolute inset-0 h-full w-full object-cover object-[30%_20%] pixelado"
            />
            <ul className="relative space-y-2.5 p-6 sm:p-10">
              {con.map((c, i) => (
                <Tarjeta key={c.tema} {...c} tipo="con" i={i} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Container>
  </section>
);
