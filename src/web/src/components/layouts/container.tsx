import type * as React from 'react';

import { cn } from '@/utils/cn';

// Horizontal page rhythm: same max-width and gutters on every screen.
export const Container = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn('mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8', className)}
    {...props}
  />
);
