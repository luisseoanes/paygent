import type * as React from 'react';

import paisaje from '@/assets/paisaje-cielo.png';
import { NubePixel } from '@/components/brand/nube-pixel';
import { Heading } from '@/components/ui/typography';
import { cn } from '@/utils/cn';

// Marco de iniciar sesión, registrarse y enlazar: el paisaje pixel de la
// portada a pantalla completa y el formulario dentro de una nube pixel art.

export type AuthLayoutProps = {
  title: string;
  // Línea bajo el título (opcional)
  description?: React.ReactNode;
  children: React.ReactNode;
  // Enlaces bajo el formulario ("¿No tienes cuenta? Regístrate")
  footer?: React.ReactNode;
  // La nube al centro de la pantalla, sin la frase de la izquierda (registro)
  centrado?: boolean;
};

export const AuthLayout = ({
  title,
  description,
  children,
  footer,
  centrado = false,
}: AuthLayoutProps) => (
  // El paisaje ocupa toda la pantalla, también detrás del menú.
  <div className="relative isolate flex min-h-dvh flex-1 overflow-hidden bg-firma">
    <img
      src={paisaje}
      alt=""
      width={320}
      height={180}
      className="fixed inset-0 -z-10 h-full w-full animate-paneo object-cover object-[60%_100%] pixelado motion-reduce:animate-none"
    />
    <div className="fixed inset-0 -z-10 bg-linear-to-r from-grafito/30 via-transparent to-transparent" />

    <div
      className={cn(
        'mx-auto grid w-full max-w-[90rem] items-center gap-6 px-4 pt-20 pb-10 sm:px-8 lg:pt-28',
        centrado
          ? 'justify-items-center'
          : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]',
      )}
    >
      {!centrado && (
        <p className="hidden max-w-[22ch] self-end pb-6 font-geist text-[clamp(1.75rem,2.6vw,2.4rem)] leading-[1.1] font-light tracking-[-0.03em] text-paper-raised drop-shadow-[0_1px_8px_rgb(20_60_120/0.25)] lg:sticky lg:bottom-10 lg:block">
          Firmado una vez en Texas.{' '}
          <span className="font-pixel tracking-normal">
            Pagado donde no hay señal.
          </span>
        </p>
      )}

      {/* Margen para que los bultos de la nube quepan alrededor */}
      <NubePixel
        className={cn(
          'mx-6 my-14 w-auto max-w-md sm:mx-auto sm:w-full',
          !centrado && 'lg:mr-14',
        )}
      >
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Heading level="h1" className="text-3xl">
              {title}
            </Heading>
            {description && <p className="text-sm text-ink-2">{description}</p>}
          </div>
          {children}
          {footer && (
            <div className="space-y-1.5 border-t border-rule pt-4 text-sm text-ink-2">
              {footer}
            </div>
          )}
        </div>
      </NubePixel>
    </div>
  </div>
);
