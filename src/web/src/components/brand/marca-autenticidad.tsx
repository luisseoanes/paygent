import { cn } from '@/utils/cn';

// Separa lo real de lo simulado en cada dato sensible.
// REAL · TESTNET: borde sólido verde. SIMULADO: borde discontinuo gris.

export type MarcaDeAutenticidadProps = {
  kind: 'real' | 'simulado';
  label?: string;
  className?: string;
};

export const MarcaDeAutenticidad = ({
  kind,
  label,
  className,
}: MarcaDeAutenticidadProps) => (
  <span
    className={cn(
      'folio inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.625rem]',
      kind === 'real'
        ? 'border-liquidado bg-liquidado-tint text-liquidado'
        : 'border-dashed border-ink-3 text-ink-2',
      className,
    )}
  >
    {label ?? (kind === 'real' ? 'Real · testnet' : 'Simulado')}
  </span>
);
