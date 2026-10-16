import { Wifi, WifiOff } from 'lucide-react';

import { cn } from '@/utils/cn';

// Código de línea por conectividad (BRAND.md §5): sólida = en línea,
// discontinua = sin señal. Siempre con texto: el color nunca va solo.
export const EstadoConexion = ({
  online,
  className,
}: {
  online: boolean;
  className?: string;
}) => (
  <p
    role="status"
    className={cn(
      'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border-2 px-3 text-sm font-medium whitespace-nowrap',
      online
        ? 'border-solid border-liquidado/50 bg-liquidado-tint text-liquidado'
        : 'border-dashed border-pendiente-borde bg-pendiente-tint text-pendiente',
      className,
    )}
  >
    {online ? (
      <Wifi className="size-4" aria-hidden="true" />
    ) : (
      <WifiOff className="size-4" aria-hidden="true" />
    )}
    {online ? 'Con señal' : 'Sin señal'}
  </p>
);
