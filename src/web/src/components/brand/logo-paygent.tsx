import { cn } from '@/utils/cn';

// Ícono de Paygent: una P de un solo trazo cuya panza se abre en ramas.
// La raíz azul es quien firma el mandato; los puntos, quienes gastan dentro
// de él (verde: una persona, morado: un agente).

export const LogoPaygent = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn('size-8 text-grafito', className)}
  >
    <path
      d="M12 40V14a5 5 0 0 1 5-5h6a9.5 9.5 0 0 1 0 19h-3"
      stroke="currentColor"
      strokeWidth="4.5"
    />
    <path d="M32.5 18.5H38" stroke="currentColor" strokeWidth="4.5" />
    <circle cx="12" cy="40" r="4.8" fill="var(--firma)" />
    <circle cx="18" cy="28" r="3.6" fill="var(--liquidado)" />
    <circle cx="40" cy="18.5" r="3.8" fill="var(--agente)" />
  </svg>
);
