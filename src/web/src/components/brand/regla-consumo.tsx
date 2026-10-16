import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/format';

// Regla de consumo: gastado vs. tope, con marcas cada 10% y un rayado donde el
// padre limita más que el propio tope. Nunca un anillo de progreso.

export type ReglaDeConsumoProps = {
  spent: number;
  limit: number;
  // Lo que le queda al padre (si limita más que este tope)
  parentRemaining?: number;
  tone?: 'firma' | 'agente' | 'anulado' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showValues?: boolean;
  className?: string;
};

const toneClass = {
  firma: 'bg-firma',
  agente: 'bg-agente',
  anulado: 'bg-anulado',
  muted: 'bg-ink-3',
};

const heightClass = { sm: 'h-2', md: 'h-3', lg: 'h-4' };

export const ReglaDeConsumo = ({
  spent,
  limit,
  parentRemaining,
  tone = 'firma',
  size = 'md',
  label = 'Consumo',
  showValues = false,
  className,
}: ReglaDeConsumoProps) => {
  const reduceMotion = useReducedMotion();
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const capped =
    parentRemaining !== undefined && limit > 0
      ? Math.max(0, Math.min(100, ((spent + parentRemaining) / limit) * 100))
      : 100;

  return (
    <div className={cn('w-full', className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(spent * 100) / 100}
        aria-valuetext={`${formatCurrency(spent)} de ${formatCurrency(limit)}`}
        className={cn(
          'relative w-full overflow-hidden rounded-[1px] border border-rule-strong bg-paper-raised',
          heightClass[size],
        )}
      >
        <motion.div
          className={cn('absolute inset-y-0 left-0', toneClass[tone])}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            ease: 'easeOut',
          }}
        />
        {capped < 100 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--rule-strong)_0_2px,transparent_2px_5px)] opacity-70"
            style={{ left: `${capped}%` }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(10%-1px),var(--rule-strong)_calc(10%-1px),var(--rule-strong)_10%)] opacity-60"
        />
      </div>
      {showValues && (
        <div className="num mt-1 flex justify-between gap-2 text-xs text-ink-2">
          <span>{formatCurrency(spent)} gastado</span>
          <span>tope {formatCurrency(limit)}</span>
        </div>
      )}
    </div>
  );
};
