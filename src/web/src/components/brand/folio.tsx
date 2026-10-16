import { cn } from '@/utils/cn';

// Numeración consecutiva real: "N.º 000127".
export const formatFolio = (value: number) =>
  `N.º ${String(value).padStart(6, '0')}`;

export const Folio = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => (
  <span className={cn('folio text-ink-2', className)}>
    {formatFolio(value)}
  </span>
);
