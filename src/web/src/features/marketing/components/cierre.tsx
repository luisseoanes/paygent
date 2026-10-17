import { useReducedMotion } from 'motion/react';

import { Link } from '@/components/ui/link';
import { paths } from '@/config/paths';

import poster from '../assets/hero/atardecer-poster.png';
import atardecerMp4 from '../assets/hero/atardecer.mp4';
import atardecerWebm from '../assets/hero/atardecer.webm';

import { PastoPixel } from './pasto-pixel';

// Footer: el paisaje del hero al caer el día (pixel art propio en bucle,
// scripts/paisaje-hero/atardecer.html). "PAYGENT" se pone como un sol detrás
// de la cordillera; arriba se deshace en píxeles como el hero y la pradera
// baja en degradado hasta el pie de página.

// MOCK: pie de página de muestra; solo las rutas de la app son reales, el
// resto vuelve a la portada.
const columnas = [
  {
    titulo: 'Producto',
    enlaces: [
      { label: 'Mi cuenta', href: paths.cuenta.getHref() },
      { label: 'Billetera', href: paths.billetera.getHref() },
      { label: 'Caja del tendero', href: paths.tendero.getHref() },
      { label: 'Celular por SMS', href: paths.celular.getHref() },
    ],
  },
  {
    titulo: 'Paygent',
    enlaces: [
      { label: 'Qué es', href: paths.home.getHref('que-es') },
      { label: 'Cómo funciona', href: paths.home.getHref('como-funciona') },
      { label: 'Sin señal', href: paths.home.getHref('sin-senal') },
      { label: 'Agentes', href: paths.home.getHref('agentes') },
    ],
  },
  {
    titulo: 'Recursos',
    enlaces: [
      { label: 'Documentación', href: paths.home.getHref() },
      { label: 'Open Payments', href: paths.home.getHref() },
      { label: 'Interledger', href: paths.home.getHref() },
    ],
  },
];

const legales = ['Términos', 'Privacidad', 'Estado del servicio'];

const Atardecer = () => {
  const reduceMotion = useReducedMotion();
  const clase = 'block h-full w-full object-cover object-bottom pixelado';
  return reduceMotion ? (
    <img src={poster} alt="" width={640} height={300} className={clase} />
  ) : (
    <video
      autoPlay
      muted
      loop
      playsInline
      poster={poster}
      width={640}
      height={300}
      className={clase}
    >
      <source src={atardecerWebm} type="video/webm" />
      <source src={atardecerMp4} type="video/mp4" />
    </video>
  );
};

export const Cierre = () => (
  <footer className="relative isolate overflow-hidden bg-noche-prado text-paper-raised">
    {/* La escena; abajo termina en el color del pie de página */}
    <div
      aria-hidden="true"
      className="relative aspect-[32/15] max-h-[640px] w-full"
    >
      <Atardecer />
      <PastoPixel
        variante="disolver"
        className="absolute inset-x-0 top-0 z-10 rotate-180"
      />
      <span className="absolute inset-x-0 bottom-0 h-6 bg-linear-to-b from-transparent to-noche-prado" />
    </div>

    {/* Pie de página corto bajo las colinas */}
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:px-6">
      <div className="grid gap-8 sm:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
        <div>
          <p className="font-pixel text-lg tracking-wide">Paygent</p>
          <p className="mt-2 max-w-[28ch] font-geist text-[0.8125rem] leading-snug text-paper-raised/60">
            Un permiso. Muchas manos. Cualquier señal.
          </p>
        </div>
        {columnas.map((c) => (
          <nav key={c.titulo} aria-label={c.titulo}>
            <p className="font-mono text-[0.6875rem] tracking-wider text-paper-raised/45 uppercase">
              {c.titulo}
            </p>
            <ul className="mt-3 space-y-1.5">
              {c.enlaces.map((e) => (
                <li key={e.label}>
                  <Link
                    variant="unstyled"
                    to={e.href}
                    className="font-geist text-[0.8125rem] text-paper-raised/75 transition-colors hover:text-paper-raised"
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3 border-t border-paper-raised/10 pt-4 font-geist text-[0.75rem] text-paper-raised/50 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Paygent · Hecho en Medellín · Hackathon Open Payments</p>
        <ul className="flex gap-4">
          {legales.map((l) => (
            <li key={l}>
              <Link
                variant="unstyled"
                to={paths.home.getHref()}
                className="hover:text-paper-raised"
              >
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </footer>
);
