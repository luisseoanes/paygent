import type * as React from 'react';

import { cn } from '@/utils/cn';

// Composition instead of many props: <Card><CardHeader><CardTitle/>...</Card>

export const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'rounded-sm [border-width:var(--border-width)] border-rule-strong/60 bg-card text-card-foreground shadow-paper',
      className,
    )}
    {...props}
  />
);

export const CardHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
);

export const CardTitle = ({
  className,
  children,
  ...props
}: React.ComponentProps<'h3'>) => (
  <h3
    className={cn(
      'font-heading text-lg leading-tight [font-weight:var(--subheading-weight)]',
      className,
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<'p'>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);

export const CardContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
);

export const CardFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
);
