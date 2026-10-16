import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/utils/cn';

import { Spinner } from '../spinner';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-button text-[0.9375rem] font-medium tracking-[-0.005em] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          '[border-width:var(--border-width)] border-input bg-background shadow-sm hover:bg-paper-raised',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        agente: 'bg-agente text-paper-raised shadow-sm hover:bg-agente/90',
        liquidado:
          'bg-liquidado text-paper-raised shadow-sm hover:bg-liquidado/90',
      },
      size: {
        // Áreas táctiles >= 48px (BRAND.md §12)
        default: 'h-12 px-5 py-2',
        sm: 'h-10 px-3 text-sm',
        lg: 'h-14 px-7 text-[1.0625rem]',
        xl: 'h-16 px-8 text-lg [&_svg]:size-5',
        icon: 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
    icon?: React.ReactNode;
  };

export const Button = ({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  icon,
  disabled,
  children,
  ...props
}: ButtonProps) => {
  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Spinner size="sm" className="text-current" /> : icon}
      {children}
    </button>
  );
};

export { buttonVariants };
