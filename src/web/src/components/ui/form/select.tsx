import type * as React from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';

import { cn } from '@/utils/cn';

import {
  FieldWrapper,
  type FieldWrapperPassThroughProps,
} from './field-wrapper';
import { fieldBaseClassName } from './input';

export type SelectOption = {
  label: React.ReactNode;
  value: string | number;
};

export type SelectProps = React.ComponentProps<'select'> &
  FieldWrapperPassThroughProps & {
    options: SelectOption[];
    registration: Partial<UseFormRegisterReturn>;
  };

export const Select = ({
  className,
  label,
  description,
  error,
  registration,
  options,
  ...props
}: SelectProps) => {
  return (
    <FieldWrapper label={label} description={description} error={error}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldBaseClassName, 'h-10', className)}
          {...registration}
          {...props}
        >
          {options.map(({ label: optionLabel, value }) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
      )}
    </FieldWrapper>
  );
};
