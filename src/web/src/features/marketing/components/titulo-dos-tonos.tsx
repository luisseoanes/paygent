import type * as React from 'react';

import { Heading } from '@/components/ui/typography';
import { cn } from '@/utils/cn';

// Titular en dos tonos, como en Cofounder: la idea en grafito y su
// complemento en gris.
export const TituloDosTonos = ({
  id,
  oscuro,
  gris,
  centrado = false,
  className,
}: {
  id: string;
  oscuro: string;
  gris: string;
  centrado?: boolean;
  className?: string;
}) => (
  <Heading
    level="h2"
    id={id}
    className={cn(
      'font-geist text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.15] tracking-[-0.02em]',
      centrado && 'mx-auto max-w-3xl text-center',
      className,
    )}
    style={{ fontWeight: 400 }}
  >
    <span className="text-grafito">{oscuro}</span>{' '}
    <span className="text-grafito-2">{gris}</span>
  </Heading>
);

// Etiqueta pequeña de sección ("■ Antes"), en mono y minúscula.
export const Etiqueta = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      'flex items-center gap-2 font-mono text-xs text-grafito-2',
      className,
    )}
  >
    <span aria-hidden="true" className="size-1.5 bg-current" />
    {children}
  </p>
);
