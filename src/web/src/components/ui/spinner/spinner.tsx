import { cn } from '@/utils/cn';

const sizes = {
  sm: 'size-4',
  md: 'size-8',
  lg: 'size-12',
  xl: 'size-20',
};

export type SpinnerProps = {
  size?: keyof typeof sizes;
  className?: string;
};

export const Spinner = ({ size = 'md', className }: SpinnerProps) => {
  return (
    <span role="status" className="inline-flex">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(
          'animate-spin text-muted-foreground',
          sizes[size],
          className,
        )}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="sr-only">Cargando</span>
    </span>
  );
};
