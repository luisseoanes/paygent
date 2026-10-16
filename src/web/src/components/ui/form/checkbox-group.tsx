import * as React from 'react';
import { type UseFormRegisterReturn } from 'react-hook-form';

import { cn } from '@/utils/cn';

import { FormError } from './form-error';
import { type SelectOption } from './select';

// Varias casillas con el mismo nombre: react-hook-form devuelve un array con
// los valores marcados. Cada opción es un objetivo táctil de 48 px.

export type CheckboxGroupProps = {
  label: string;
  description?: string;
  // Los campos array de react-hook-form traen un error compuesto: basta el mensaje.
  error?: { message?: string };
  options: SelectOption[];
  registration: Partial<UseFormRegisterReturn>;
  className?: string;
};

export const CheckboxGroup = ({
  label,
  description,
  error,
  options,
  registration,
  className,
}: CheckboxGroupProps) => {
  const id = React.useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error?.message ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className={cn('space-y-2', className)}
    >
      <legend className="mb-2 text-sm leading-none font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="checkbox"
              value={option.value}
              className="size-4 accent-primary"
              {...registration}
            />
            {option.label}
          </label>
        ))}
      </div>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <FormError id={errorId} message={error?.message} />
    </fieldset>
  );
};
