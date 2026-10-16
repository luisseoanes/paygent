import type * as React from 'react';

import { cn } from '@/utils/cn';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  // Slot for a call to action (e.g. a "Create" button).
  action?: React.ReactNode;
  className?: string;
};

export const EmptyState = ({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-rule-strong p-10 text-center',
      className,
    )}
  >
    {icon && (
      <div className="rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-6">
        {icon}
      </div>
    )}
    <p className="font-heading text-base [font-weight:var(--subheading-weight)]">
      {title}
    </p>
    {description && (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
