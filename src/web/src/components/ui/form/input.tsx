import type * as React from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';

import { cn } from '@/utils/cn';

import {
  FieldWrapper,
  type FieldWrapperPassThroughProps,
} from './field-wrapper';

export const fieldBaseClassName =
  'flex w-full rounded-md border-input [border-width:var(--border-width)] bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30';

export type InputProps = React.ComponentProps<'input'> &
  FieldWrapperPassThroughProps & {
    registration: Partial<UseFormRegisterReturn>;
  };

export const Input = ({
  className,
  label,
  description,
  error,
  registration,
  ...props
}: InputProps) => {
  return (
    <FieldWrapper label={label} description={description} error={error}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldBaseClassName,
            'h-10 file:border-0 file:bg-transparent file:text-sm file:font-medium',
            className,
          )}
          {...registration}
          {...props}
        />
      )}
    </FieldWrapper>
  );
};
