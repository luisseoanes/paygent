import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/utils/cn';

// Sello de tinta: el momento ceremonial de autorización o decisión.
// Colores con significado fijo (BRAND.md §3).

const selloVariants = cva(
  'pointer-events-none relative inline-flex shrink-0 items-center justify-center rounded-full border-[3px] font-mono font-semibold tracking-[0.12em] uppercase select-none',
  {
    variants: {
      variant: {
        autorizado: 'border-firma text-firma',
        agente: 'border-agente text-agente',
        liquidado: 'border-liquidado text-liquidado',
        rechazado: 'border-anulado text-anulado',
        congelado: 'border-anulado text-anulado',
        anulado: 'border-anulado text-anulado',
        // Vale guardado sin señal: borde discontinuo (código de conectividad)
        pendiente: 'border-dashed border-pendiente-borde text-pendiente',
      },
      size: {
        sm: 'size-14 text-[0.4375rem] tracking-[0.04em]',
        md: 'size-24 text-[0.6875rem]',
        lg: 'size-32 text-sm',
      },
    },
    defaultVariants: { variant: 'autorizado', size: 'md' },
  },
);

const labels = {
  autorizado: 'Autorizado',
  agente: 'Agente',
  liquidado: 'Liquidado',
  rechazado: 'Rechazado',
  congelado: 'Congelado',
  anulado: 'Anulado',
  pendiente: 'Por cobrar',
} as const;

// Rotación determinista por id, entre −6° y 4°.
const rotationFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 11) - 6;
};

export type SelloProps = VariantProps<typeof selloVariants> & {
  seed?: string;
  // Anima la caída (escala 1.6 → 1, 220ms)
  animate?: boolean;
  className?: string;
  label?: string;
};

export const Sello = ({
  variant = 'autorizado',
  size,
  seed = 'sello',
  animate = true,
  className,
  label,
}: SelloProps) => {
  const reduceMotion = useReducedMotion();
  const rotate = rotationFor(seed);
  const text = label ?? labels[variant ?? 'autorizado'];

  return (
    <motion.span
      role="img"
      aria-label={`Sello: ${text}`}
      className={cn(selloVariants({ variant, size }), className)}
      initial={
        animate && !reduceMotion
          ? { scale: 1.6, opacity: 0, rotate }
          : { scale: 1, opacity: 0.92, rotate }
      }
      animate={{ scale: 1, opacity: 0.92, rotate }}
      transition={{ duration: 0.22, ease: [0.2, 1.4, 0.4, 1] }}
      style={{ mixBlendMode: 'multiply' }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-[5px] rounded-full border border-dashed border-current opacity-70"
      />
      <span
        aria-hidden="true"
        className="relative px-1.5 text-center leading-tight"
      >
        {text}
      </span>
    </motion.span>
  );
};
