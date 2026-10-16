import * as React from 'react';
import { type FieldError } from 'react-hook-form';

import { FormError } from './form-error';
import { Label } from './label';

type FieldWrapperProps = {
  label?: string;
  description?: string;
  error?: FieldError;
  className?: string;
  // Receives the ids that the control must use for accessibility.
  children: (ids: {
    id: string;
    describedBy: string | undefined;
  }) => React.ReactNode;
};

export type FieldWrapperPassThroughProps = Pick<
  FieldWrapperProps,
  'label' | 'description' | 'error'
>;

export const FieldWrapper = ({
  label,
  description,
  error,
  className,
  children,
}: FieldWrapperProps) => {
  const id = React.useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error?.message ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className="space-y-2">
        {label && <Label htmlFor={id}>{label}</Label>}
        {children({ id, describedBy })}
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <FormError id={errorId} message={error?.message} />
    </div>
  );
};
