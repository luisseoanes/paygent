import type * as React from 'react';

import { cn } from '@/utils/cn';

// Placeholder that mirrors the shape of the content while it loads.
export const Skeleton = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-muted', className)}
    {...props}
  />
);
