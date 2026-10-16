import { zodResolver } from '@hookform/resolvers/zod';
import type * as React from 'react';
import {
  type FieldValues,
  FormProvider,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
  useForm,
} from 'react-hook-form';
import type * as z from 'zod';

import { cn } from '@/utils/cn';

// Abstraction over react-hook-form + zod. Every form in the app uses it:
//
// <Form schema={schema} onSubmit={(values) => mutation.mutate({ data: values })}>
//   {({ register, formState }) => (
//     <Input label="Email" error={formState.errors.email} registration={register('email')} />
//   )}
// </Form>

export type FormProps<
  TInput extends FieldValues,
  TOutput extends FieldValues,
> = {
  schema: z.ZodType<TOutput, TInput>;
  onSubmit: SubmitHandler<TOutput>;
  children: (
    methods: UseFormReturn<TInput, unknown, TOutput>,
  ) => React.ReactNode;
  options?: UseFormProps<TInput, unknown, TOutput>;
  className?: string;
  id?: string;
};

export const Form = <TInput extends FieldValues, TOutput extends FieldValues>({
  schema,
  onSubmit,
  children,
  options,
  className,
  id,
}: FormProps<TInput, TOutput>) => {
  const form = useForm<TInput, unknown, TOutput>({
    ...options,
    resolver: zodResolver(schema),
  });

  return (
    <FormProvider {...form}>
      <form
        id={id}
        noValidate
        className={cn('space-y-5', className)}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {children(form)}
      </form>
    </FormProvider>
  );
};
