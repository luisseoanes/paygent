import { ArrowRight } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { Heading } from '@/components/ui/typography';
import { paths } from '@/config/paths';

import paisaje from '../assets/paisaje-cielo.png';
import { PASOS, useGuion } from '../hooks/use-guion';

import { PastoPixel } from './pasto-pixel';

// Hero con la estructura de Cofounder (Mobbin): cielo pixel despejado arriba
// a la izquierda para el titular, montañas de Antioquia abajo a la derecha y,
// apoyado en ellas, el celular de teclas. Los mensajes del agente salen como
// nubes de píxeles. Foto base: Juan Nino en Unsplash (licencia Unsplash).

// Silueta de nube pixelada (filas escalonadas) usada como globo de mensaje.
const NUBE = 'M5 0h6v1h2v1h3v1h1v1h1v3h-1v1H1V7H0V4h1V3h1V2h2V1h1z';

const NubeMensaje = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <div className="relative w-[17rem] drop-shadow-[0_8px_14px_rgb(28_34_48/0.18)]">
    <svg
      aria-hidden="true"
      viewBox="0 0 18 8"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className="absolute inset-0 h-full w-full"
    >
      <path d={NUBE} fill="var(--paper-raised)" />
      <path d="M1 7h16v1H1z" fill="var(--hueso-2)" />
    </svg>
    <div className="relative px-8 pt-7 pb-6 text-center">
      <p className="font-geist text-xs font-semibold text-grafito">{titulo}</p>
      <p className="mt-0.5 font-geist text-xs leading-snug text-grafito/75">
        {texto}
      </p>
    </div>
  </div>
);

const MensajesEnNube = ({ paso }: { paso: number }) => {
  const reduceMotion = useReducedMotion();
  const mensaje =
    paso >= PASOS.pagado
      ? {
          titulo: 'Pagado · $3,00',
          texto: 'Directo a la farmacia. Retiro 4821.',
        }
      : paso >= PASOS.oferta
        ? {
            titulo: 'El agente encontró',
            texto: 'Losartán a $12.000, a 3 cuadras.',
          }
        : paso >= PASOS.consultando
          ? {
              titulo: 'Pedido por SMS',
              texto: '"necesito la pastilla de la presion"',
            }
          : null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute -top-6 right-[78%] z-20 hidden md:block"
    >
      <AnimatePresence mode="wait">
        {mensaje && (
          <motion.div
            key={mensaje.titulo}
            initial={reduceMotion ? false : { opacity: 0, x: 24, y: 6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
            transition={{ duration: 0.5, ease: [0.3, 0.7, 0.2, 1] }}
          >
            <NubeMensaje {...mensaje} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export type HeroPaisajeProps = {
  // El celular lo pone la ruta (feature celular); recibe el paso del guion.
  telefono: (paso: number) => React.ReactNode;
};

export const HeroPaisaje = ({ telefono }: HeroPaisajeProps) => {
  const reduceMotion = useReducedMotion();
  const { paso } = useGuion();
  const ref = React.useRef<HTMLElement>(null);
  // Al bajar, el paisaje se queda un poco atrás (profundidad) y el titular
  // se aleja.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const paisajeY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);
  const titularY = useTransform(scrollYProgress, [0, 0.5], [0, 90]);
  const titularOpacidad = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  return (
    <section
      ref={ref}
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-firma"
    >
      {/* Paisaje: cielo despejado arriba, montañas abajo a la derecha */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -z-10 overflow-hidden"
        style={reduceMotion ? undefined : { y: paisajeY }}
      >
        <img
          src={paisaje}
          alt=""
          width={320}
          height={180}
          className="h-full w-full animate-paneo object-cover object-[60%_100%] pixelado motion-reduce:animate-none"
        />
      </motion.div>

      <div className="mx-auto grid min-h-[min(calc(100svh+32px),900px)] w-full max-w-[1400px] grid-rows-[auto_1fr] gap-6 px-4 pt-28 sm:px-6 lg:grid-cols-12 lg:px-10 lg:pt-32">
        {/* Fuera: se aleja con el scroll. Dentro: entra al cargar. */}
        <motion.div
          className="lg:col-span-5 lg:-mt-8"
          style={
            reduceMotion ? undefined : { y: titularY, opacity: titularOpacidad }
          }
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.3, 0.7, 0.2, 1] }}
          >
            <Heading
              level="display"
              id="hero-title"
              className="font-geist text-[clamp(2.1rem,3.6vw,3.4rem)] leading-[1.08] tracking-[-0.03em] text-paper-raised drop-shadow-[0_1px_8px_rgb(20_60_120/0.25)]"
              style={{ fontWeight: 300, fontVariationSettings: 'normal' }}
            >
              Pagar no debería necesitar{' '}
              <span
                className="font-pixel tracking-normal"
                style={{ fontWeight: 500 }}
              >
                internet.
              </span>
            </Heading>
            <p className="mt-4 max-w-[40ch] font-geist text-[1.0625rem] leading-relaxed text-paper-raised/90">
              Un solo permiso de Open Payments para personas y agentes de IA:
              pagan con datos, sin señal o por SMS.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Button
                asChild
                className="h-11 rounded-lg bg-paper-raised px-5 font-geist text-[0.9375rem] text-grafito shadow-sm hover:bg-hueso"
              >
                <Link variant="unstyled" to={paths.juan.getHref()}>
                  Entrar a mi mandato
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-lg border-paper-raised/80 bg-ink/15 px-5 font-geist text-[0.9375rem] font-medium text-paper-raised backdrop-blur-md hover:bg-paper-raised/25"
              >
                <a href="#que-es-real">Qué es real</a>
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* El objeto, apoyado en las montañas */}
        <div className="relative flex items-end justify-center pb-20 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:justify-end lg:pb-28">
          <motion.div
            className="relative w-[min(260px,72vw)] lg:w-[270px]"
            initial={reduceMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.15,
              ease: [0.3, 0.7, 0.2, 1],
            }}
          >
            <MensajesEnNube paso={paso} />
            <span
              aria-hidden="true"
              className="absolute -bottom-3 left-1/2 h-8 w-[85%] -translate-x-1/2 rounded-[50%] bg-ink/40 blur-xl"
            />
            <div className="relative [&>div]:max-w-none">{telefono(paso)}</div>
          </motion.div>
        </div>
      </div>

      <PastoPixel
        variante="disolver"
        className="absolute inset-x-0 bottom-0 z-10"
      />
    </section>
  );
};
