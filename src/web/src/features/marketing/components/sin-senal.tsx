import { Check, MessageSquareText, Store, Ticket, WifiOff } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';
import * as React from 'react';

import { Sello } from '@/components/brand/sello';
import { Container } from '@/components/layouts';
import { cn } from '@/utils/cn';

import {
  deviceCertificate,
  devicePublicKeyHex,
  signVoucher,
  verifyVoucherSignature,
} from '../utils/crypto';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// "Sin señal" (referencia en Mobbin: "No signal? No problem" de Evernote).
// Escena en bucle: se corta la señal → el celular firma un vale → el vale
// llega al tendero → la firma se verifica sin internet → al volver la señal
// se liquida. La firma ed25519 se genera y se verifica de verdad aquí mismo.

const FASES = [
  'En línea',
  'Sin señal',
  'Vale firmado',
  'Verificado sin internet',
  'Liquidado',
];

const vale = (() => {
  const firmado = signVoucher({
    v: 1,
    id: 'vale_portada',
    node: 'maria-key',
    usd: 4.5,
    cop: 18000,
    cat: 'mercado',
    iat: 0,
    exp: 0,
  });
  const ok = verifyVoucherSignature({
    ...firmado,
    devicePublicKey: devicePublicKeyHex,
    certificate: deviceCertificate,
  });
  return { ...firmado, ok };
})();

const Ondas = ({ cortadas }: { cortadas: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 60 40" className="h-10 w-16">
    {[10, 18, 26].map((r, i) => (
      <motion.path
        key={r}
        d={`M${30 - r} ${36 - r * 0.6} A ${r} ${r} 0 0 1 ${30 + r} ${36 - r * 0.6}`}
        fill="none"
        stroke={cortadas ? 'var(--anulado)' : 'var(--firma)'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={cortadas ? '3 4' : undefined}
        initial={false}
        animate={{ opacity: cortadas ? 0.35 : 1 - i * 0.2 }}
      />
    ))}
  </svg>
);

const Escena = ({ fase }: { fase: number }) => {
  const reduceMotion = useReducedMotion();
  const sinSenal = fase >= 1 && fase <= 3;
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-hueso-2 bg-hueso/60 bg-[radial-gradient(circle,var(--hueso-2)_1px,transparent_1.5px)] bg-[length:18px_18px]">
      {/* María */}
      <div className="absolute top-[18%] left-[7%] flex w-[30%] flex-col items-center gap-2">
        <Ondas cortadas={sinSenal} />
        <div className="w-full rounded-2xl border-4 border-carcasa bg-paper-raised p-3 shadow-sm">
          <p className="font-geist text-[0.6875rem] text-grafito-2">María</p>
          <p
            className={cn(
              'mt-1 flex items-center gap-1 font-geist text-xs font-medium',
              sinSenal ? 'text-anulado' : 'text-liquidado',
            )}
          >
            {sinSenal ? (
              <WifiOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
            {sinSenal ? 'Sin señal' : 'En línea'}
          </p>
          <p className="num mt-2 text-lg font-semibold text-grafito">$18.000</p>
        </div>
      </div>

      {/* Tendero */}
      <div className="absolute top-[30%] right-[7%] w-[30%] rounded-xl border border-hueso-2 bg-paper-raised p-3 shadow-sm">
        <p className="flex items-center gap-1.5 font-geist text-[0.6875rem] text-grafito-2">
          <Store className="size-3.5" aria-hidden="true" /> Tienda de don Abel
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={fase >= 3 ? 'ok' : 'espera'}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'mt-2 font-geist text-xs font-medium',
              fase >= 3 ? 'text-liquidado' : 'text-grafito-2',
            )}
          >
            {fase >= 3
              ? '✓ Firma verificada sin internet'
              : 'Esperando un vale…'}
          </motion.p>
        </AnimatePresence>
        {fase >= 4 && (
          <span className="absolute -top-6 -right-4">
            <Sello variant="liquidado" size="sm" seed="vale-portada" />
          </span>
        )}
      </div>

      {/* El vale que viaja */}
      <AnimatePresence>
        {fase >= 2 && (
          <motion.div
            key="vale"
            className="absolute top-[62%] flex items-center gap-2 rounded-md border-2 border-dashed border-pendiente-borde bg-paper-raised px-3 py-2 shadow-sm"
            initial={reduceMotion ? false : { left: '12%', opacity: 0 }}
            animate={{ left: fase >= 3 ? '56%' : '24%', opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.9,
              ease: [0.65, 0, 0.35, 1],
            }}
          >
            <Ticket className="size-4 text-pendiente" aria-hidden="true" />
            <span>
              <span className="block font-geist text-[0.6875rem] font-medium text-grafito">
                Vale · $18.000
              </span>
              <span className="num block text-[0.5625rem] text-grafito-2">
                ed25519 · {vale.signature.slice(0, 12)}…
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado */}
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-paper-raised px-3 py-1 font-geist text-xs text-grafito shadow-sm">
        {FASES[fase]}
      </p>
    </div>
  );
};

export const SinSenal = () => {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { amount: 0.4 });
  const [fase, setFase] = React.useState(reduceMotion ? 4 : 0);

  React.useEffect(() => {
    if (reduceMotion || !enVista) return;
    const id = setInterval(() => setFase((f) => (f + 1) % FASES.length), 1900);
    return () => clearInterval(id);
  }, [enVista, reduceMotion]);

  return (
    <section aria-labelledby="senal-title" className="bg-hueso">
      <Container className="max-w-6xl py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div ref={ref} className="order-2 lg:order-1 lg:col-span-7">
            <div className="rounded-xl border border-hueso-2 bg-paper-raised/70 p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.35)]">
              <Escena fase={fase} />
            </div>
            <p className="mt-3 text-center font-geist text-xs text-grafito-2">
              Esta firma se acaba de generar y verificar en tu navegador:{' '}
              <span className={vale.ok ? 'text-liquidado' : 'text-anulado'}>
                {vale.ok ? 'válida' : 'inválida'}
              </span>
              .
            </p>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5">
            <Etiqueta>Sin señal y sin smartphone</Etiqueta>
            <TituloDosTonos
              id="senal-title"
              className="mt-3"
              oscuro="¿Sin señal?"
              gris="Igual se paga."
            />
            <ul className="mt-8 space-y-5">
              <li className="flex gap-3">
                <Ticket
                  className="mt-0.5 size-5 shrink-0 text-pendiente"
                  aria-hidden="true"
                />
                <span>
                  <span className="block font-geist text-[0.9375rem] font-medium text-grafito">
                    Vale firmado en el celular
                  </span>
                  <span className="block font-geist text-sm text-grafito-2">
                    El tendero lo verifica sin internet. Se cobra al volver la
                    conexión, con un tope sin señal que ajusta el Guardián.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <MessageSquareText
                  className="mt-0.5 size-5 shrink-0 text-firma"
                  aria-hidden="true"
                />
                <span>
                  <span className="block font-geist text-[0.9375rem] font-medium text-grafito">
                    Un SMS desde un celular de teclas
                  </span>
                  <span className="block font-geist text-sm text-grafito-2">
                    «necesito la pastilla de la presion». El agente encuentra la
                    farmacia, pide el PIN y paga.
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
};
