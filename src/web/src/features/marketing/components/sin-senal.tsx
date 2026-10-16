import { Check, X } from 'lucide-react';
import {
  AnimatePresence,
  type MotionValue,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import * as React from 'react';

import { Sello } from '@/components/brand/sello';
import { cn } from '@/utils/cn';

import vereda from '../assets/historia/1-vereda.png';
import pueblo from '../assets/historia/2-pueblo.png';
import tienda from '../assets/historia/3-tienda.png';
import celular from '../assets/historia/4-celular.png';
import donaRosa from '../assets/historia/5-dona-rosa.png';
import atardecer from '../assets/historia/6-atardecer.png';
import {
  deviceCertificate,
  devicePublicKeyHex,
  signVoucher,
  verifyVoucherSignature,
} from '../utils/crypto';

import { Etiqueta, TituloDosTonos } from './titulo-dos-tonos';

// "Sin señal" contado como historieta: seis viñetas pixel art que suben una
// sobre otra con el scroll (la de atrás se encoge y se oscurece). Cada una
// trae su recuadro de narración y lo que pasa en ella: la señal se cae, el
// celular firma un vale, la tienda lo verifica sin internet y, al volver la
// señal, se cobra. La firma ed25519 se genera y se verifica aquí mismo.
//
// Fotos de Unsplash (licencia Unsplash), pixeladas a 320×180 como el hero:
// Dan Gold (vereda), Reza Madani (pueblo), Sergio Aguirre (tienda),
// Sumeet Singh (celular), Jonathan Trans (tienda por dentro), Denise
// Leisner (atardecer).

const vale = (() => {
  const firmado = signVoucher({
    v: 1,
    id: 'vale_historia',
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
  return { firma: firmado.signature, ok };
})();

// Barras de cobertura en pixel: 4 rayas, encendidas según la señal.
const BarrasSenal = ({ rayas }: { rayas: number }) => (
  <span
    role="img"
    aria-label={rayas ? `Señal: ${rayas} de 4 rayas` : 'Sin señal'}
    className="relative inline-flex items-end gap-1"
  >
    {[1, 2, 3, 4].map((n) => (
      <motion.span
        key={n}
        className={cn(
          'w-2.5',
          n <= rayas
            ? rayas <= 1
              ? 'bg-pendiente'
              : 'bg-liquidado'
            : 'bg-paper-raised/35',
        )}
        initial={false}
        animate={{ height: n * 7, opacity: n <= rayas ? 1 : 0.5 }}
      />
    ))}
    {rayas === 0 && (
      <X
        className="absolute -top-1 -right-4 size-5 text-anulado"
        strokeWidth={3}
        aria-hidden="true"
      />
    )}
  </span>
);

const Chip = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-3 border-2 border-grafito bg-grafito/80 px-3 py-2 font-pixel text-sm text-paper-raised',
      className,
    )}
  >
    {children}
  </span>
);

// El vale de papel que sale del celular: perforado, con la firma tecleándose.
const ValePapel = ({ activo }: { activo: boolean }) => {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!activo) return setN(0);
    const id = setInterval(() => setN((v) => (v >= 32 ? v : v + 1)), 45);
    return () => clearInterval(id);
  }, [activo]);

  return (
    <div className="perforacion-top relative w-64 border-2 border-grafito bg-paper-raised px-4 pt-5 pb-4 shadow-[6px_6px_0_rgb(31_31_34/0.85)]">
      <p className="font-pixel text-xs text-ink-2">VALE N.º 1</p>
      <p className="cifra mt-1 text-3xl leading-none text-grafito">$18.000</p>
      <p className="mt-1 text-sm text-grafito">Tienda Las Tablitas</p>
      <p className="num mt-3 h-8 text-[0.625rem] leading-tight break-all text-ink-2">
        ed25519 · {vale.firma.slice(0, n)}
        {n < 32 && <span className="animate-pulse">▌</span>}
      </p>
      <span className="absolute -top-8 -right-8">
        {n >= 32 && (
          <Sello variant="autorizado" label="Firmado" size="sm" seed="firma" />
        )}
      </span>
    </div>
  );
};

const Verificacion = ({ activo }: { activo: boolean }) => (
  <div className="w-72 border-2 border-grafito bg-paper-raised p-4 shadow-[6px_6px_0_rgb(31_31_34/0.85)]">
    <div className="relative h-14 overflow-hidden border-2 border-dashed border-rule-strong bg-paper">
      <p className="num absolute inset-0 flex items-center justify-center text-[0.625rem] text-ink-2">
        {vale.firma.slice(0, 24)}…
      </p>
      {activo && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 w-1 bg-firma shadow-[0_0_12px_var(--firma)]"
          initial={{ left: '0%' }}
          animate={{ left: ['0%', '100%', '0%'] }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
      )}
    </div>
    <AnimatePresence>
      {activo && (
        <motion.p
          className={cn(
            'mt-3 flex items-center gap-2 font-medium',
            vale.ok ? 'text-liquidado' : 'text-anulado',
          )}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          <Check className="size-5" strokeWidth={3} aria-hidden="true" />
          {vale.ok ? 'Firma válida' : 'Firma inválida'} · sin internet
        </motion.p>
      )}
    </AnimatePresence>
    <p className="mt-1 text-xs text-ink-2">
      Verificada ahora mismo en tu navegador.
    </p>
  </div>
);

type Vineta = {
  img: string;
  // Encuadre de la foto en pantallas angostas
  foco: string;
  hora: string;
  texto: string;
  // Lo que aparece en la viñeta cuando es la de adelante
  escena: (activo: boolean) => React.ReactNode;
};

const VINETAS: Vineta[] = [
  {
    img: vereda,
    foco: 'object-[60%_50%]',
    hora: '7:00 a. m. · Vereda El Retiro',
    texto:
      'Juan, desde Texas, le dejó a María un permiso para pagar: hasta $150 al mes.',
    escena: () => (
      <Chip>
        <BarrasSenal rayas={4} /> Con señal
      </Chip>
    ),
  },
  {
    img: pueblo,
    foco: 'object-[55%_50%]',
    hora: '9:30 a. m. · El pueblo',
    texto: 'María baja al pueblo a comprar el mercado. La señal va y viene.',
    escena: () => (
      <Chip>
        <BarrasSenal rayas={1} /> Señal débil
      </Chip>
    ),
  },
  {
    img: tienda,
    foco: 'object-[45%_50%]',
    hora: '10:00 a. m. · Tienda Las Tablitas',
    texto: 'Adentro de la tienda no entra la señal. Ni datos, ni wifi.',
    escena: (activo) => (
      <div className="flex flex-col items-end gap-4">
        <Chip>
          <BarrasSenal rayas={0} /> Sin señal
        </Chip>
        {activo && (
          <Sello variant="rechazado" label="Sin señal" size="lg" seed="sin" />
        )}
      </div>
    ),
  },
  {
    img: celular,
    foco: 'object-[35%_50%]',
    hora: '10:02 a. m. · El celular de María',
    texto:
      'María toca Pagar. Su celular firma un vale con su llave: es matemática, no necesita internet.',
    escena: (activo) => (
      <motion.div
        initial={false}
        animate={activo ? { x: 0, opacity: 1 } : { x: -40, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.3, 0.7, 0.2, 1] }}
      >
        <ValePapel activo={activo} />
      </motion.div>
    ),
  },
  {
    img: donaRosa,
    foco: 'object-[70%_50%]',
    hora: '10:02 a. m. · Doña Rosa',
    texto:
      'Doña Rosa escanea el vale. Su app comprueba la firma ahí mismo, sin conexión, y le entrega el mercado.',
    escena: (activo) => <Verificacion activo={activo} />,
  },
  {
    img: atardecer,
    foco: 'object-[60%_50%]',
    hora: '5:40 p. m. · Vuelve la señal',
    texto:
      'En la tarde vuelve la señal. El vale se cobra solo y la plata llega a la tienda.',
    escena: (activo) => (
      <div className="flex flex-col items-end gap-4">
        <Chip>
          <BarrasSenal rayas={4} /> Señal de vuelta
        </Chip>
        {activo && (
          <Sello variant="liquidado" label="Cobrado" size="lg" seed="cobro" />
        )}
      </div>
    ),
  },
];

const Narracion = ({
  vineta,
  indice,
  activo,
}: {
  vineta: Vineta;
  indice: number;
  activo: boolean;
}) => (
  <motion.div
    className="max-w-md border-2 border-grafito bg-paper-raised px-4 py-3 shadow-[6px_6px_0_rgb(31_31_34/0.85)]"
    initial={false}
    animate={activo ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
    transition={{ duration: 0.5, delay: activo ? 0.25 : 0 }}
  >
    <p className="font-pixel text-xs text-firma">
      {indice + 1}/{VINETAS.length} · {vineta.hora}
    </p>
    <p className="mt-1 text-[0.9375rem] leading-snug text-grafito sm:text-lg">
      {vineta.texto}
    </p>
  </motion.div>
);

const Cuadro = ({
  vineta,
  indice,
  activo,
  className,
}: {
  vineta: Vineta;
  indice: number;
  activo: boolean;
  className?: string;
}) => (
  <div
    className={cn(
      'relative h-full w-full overflow-hidden border-4 border-grafito bg-grafito',
      className,
    )}
  >
    <img
      src={vineta.img}
      alt=""
      width={320}
      height={180}
      loading="lazy"
      className={cn('h-full w-full object-cover pixelado', vineta.foco)}
    />
    <div className="absolute inset-0 bg-linear-to-t from-grafito/55 via-transparent to-grafito/25" />
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
      {vineta.escena(activo)}
    </div>
    <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:left-6">
      <Narracion vineta={vineta} indice={indice} activo={activo} />
    </div>
  </div>
);

// Una viñeta de la pila: sube desde abajo cuando le toca y, cuando la tapa
// la siguiente, se encoge y se oscurece.
const ViñetaApilada = ({
  vineta,
  indice,
  avance,
  activo,
}: {
  vineta: Vineta;
  indice: number;
  // 0 … VINETAS.length - 1
  avance: MotionValue<number>;
  activo: boolean;
}) => {
  const y = useTransform(avance, (k) => {
    if (indice === 0) return '0%';
    const t = Math.min(1, Math.max(0, (k - (indice - 1) - 0.15) / 0.7));
    return `${(1 - t) * 108}%`;
  });
  const tapada = useTransform(avance, (k) =>
    Math.min(1, Math.max(0, (k - indice - 0.15) / 0.7)),
  );
  const scale = useTransform(tapada, [0, 1], [1, 0.93]);
  const brillo = useTransform(tapada, [0, 1], [0, 0.45]);
  const giro = indice % 2 === 0 ? -0.6 : 0.6;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ y, scale, rotate: giro, zIndex: indice }}
    >
      <Cuadro vineta={vineta} indice={indice} activo={activo} />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grafito"
        style={{ opacity: brillo }}
      />
    </motion.div>
  );
};

export const SinSenal = () => {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const avance = useTransform(scrollYProgress, [0, 1], [0, VINETAS.length - 1]);
  const [activa, setActiva] = React.useState(0);
  useMotionValueEvent(avance, 'change', (k) =>
    setActiva(Math.min(VINETAS.length - 1, Math.floor(k + 0.35))),
  );

  return (
    <section aria-labelledby="senal-title" className="bg-hueso">
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:pt-24">
        <Etiqueta>Una historia en seis viñetas</Etiqueta>
        <TituloDosTonos
          id="senal-title"
          className="mt-3"
          oscuro="¿Sin señal?"
          gris="Igual se paga."
        />
        <p className="mt-4 text-[1.0625rem] text-ink-2">
          Así paga María donde no entra internet. Baja despacio.
        </p>
      </div>

      {reduceMotion ? (
        // Sin movimiento: las viñetas, una debajo de otra.
        <ol className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
          {VINETAS.map((v, i) => (
            <li key={v.hora} className="aspect-[16/10] sm:aspect-[16/9]">
              <Cuadro vineta={v} indice={i} activo />
            </li>
          ))}
        </ol>
      ) : (
        <div
          ref={ref}
          className="relative"
          style={{ height: `${VINETAS.length * 100}svh` }}
        >
          <div className="sticky top-0 flex h-svh flex-col items-center justify-center gap-4 px-4 py-6">
            <ol aria-label="Viñetas" className="flex items-center gap-2">
              {VINETAS.map((v, i) => (
                <li key={v.hora}>
                  <span
                    aria-current={i === activa ? 'step' : undefined}
                    className={cn(
                      'block h-2 transition-all duration-300',
                      i === activa
                        ? 'w-8 bg-firma'
                        : i < activa
                          ? 'w-2 bg-grafito'
                          : 'w-2 bg-rule-strong',
                    )}
                  />
                  <span className="sr-only">
                    Viñeta {i + 1}: {v.hora}
                  </span>
                </li>
              ))}
            </ol>
            {/* Recorta: las viñetas que esperan turno no asoman por debajo */}
            <div className="h-[min(74svh,660px)] w-[min(96vw,1120px)] overflow-hidden p-2">
              <div className="relative h-full w-full">
                {VINETAS.map((v, i) => (
                  <ViñetaApilada
                    key={v.hora}
                    vineta={v}
                    indice={i}
                    avance={avance}
                    activo={i === activa}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
