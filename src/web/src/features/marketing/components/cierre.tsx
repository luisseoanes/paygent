import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { Heading } from '@/components/ui/typography';
import { paths } from '@/config/paths';

import paisaje from '../assets/paisaje.png';

import { PastoPixel } from './pasto-pixel';

// Cierre con la estructura del footer de Cofounder (Mobbin): titular en dos
// tonos, enlaces, tarjeta de vidrio sobre una ilustración pixel y la franja
// de pasto pixelado al final.

// MOCK: solo "Árbol de mandatos" e "Iniciar sesión" son pantallas reales;
// el resto apunta a secciones de esta portada hasta que existan.
const enlaces = [
  [
    { label: 'Árbol de mandatos', href: paths.cuenta.getHref() },
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Agentes', href: '#agentes' },
  ],
  [
    { label: 'Sin señal', href: '#sin-senal' },
    { label: 'Qué es real', href: '#que-es-real' },
    { label: 'Iniciar sesión', href: paths.auth.login.getHref() },
  ],
];

export const Cierre = () => (
  <section aria-labelledby="cierre-title" className="bg-hueso">
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:items-center lg:px-8">
      <div>
        <Heading
          level="h2"
          id="cierre-title"
          className="font-geist text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.15] tracking-[-0.02em]"
          style={{ fontWeight: 400 }}
        >
          <span className="text-grafito">Un solo permiso,</span>{' '}
          <span className="text-grafito-2">
            repartido entre personas y agentes.
          </span>
        </Heading>
        <p className="mt-6 font-geist text-[0.8125rem] text-grafito-2">
          Cómo <span className="text-grafito">Con datos</span> ·{' '}
          <span className="text-grafito">Sin señal</span> ·{' '}
          <span className="text-grafito">Por SMS</span>
        </p>
        <nav
          aria-label="Enlaces de la portada"
          className="mt-6 grid max-w-sm grid-cols-2 gap-x-8 gap-y-2"
        >
          {enlaces.map((col, i) => (
            <ul key={i} className="space-y-2">
              {col.map((e) => (
                <li key={e.href}>
                  <Link
                    variant="unstyled"
                    to={e.href}
                    className="font-geist text-[0.8125rem] text-grafito hover:underline"
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>
        <p className="mt-8 font-geist text-xs text-grafito-2">
          Sobre{' '}
          <span className="rounded border border-hueso-2 px-1.5 py-0.5 text-grafito">
            Open Payments
          </span>{' '}
          · red de prueba de Interledger
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-sm rounded-2xl border border-hueso-2 bg-paper-raised p-2 shadow-[0_30px_60px_-40px_rgb(28_34_48/0.45)]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          <img
            src={paisaje}
            alt=""
            width={320}
            height={180}
            className="absolute inset-0 h-full w-full object-cover object-[30%_60%] pixelado"
          />
          <div className="absolute inset-x-3 bottom-3 rounded-xl border border-vidrio-borde bg-vidrio p-4 backdrop-blur-md">
            <p className="font-geist text-lg leading-snug font-medium text-grafito">
              Paygent es una red de permisos delegables{' '}
              <span className="text-grafito/60">
                para pagar donde no llega internet.
              </span>
            </p>
            <Button
              size="sm"
              asChild
              className="mt-4 rounded-lg bg-paper-raised font-geist text-grafito shadow-sm hover:bg-hueso"
            >
              <Link variant="unstyled" to={paths.cuenta.getHref()}>
                Entrar a mi mandato
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>

    <p className="pb-2 text-center font-geist text-[0.6875rem] text-grafito-2">
      Hecho en Medellín · Hackathon 2026
    </p>
    <PastoPixel variante="pasto" />
  </section>
);
