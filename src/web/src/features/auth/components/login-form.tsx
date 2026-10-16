import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormError, Input } from '@/components/ui/form';
import { DEMO_PASSWORD, demoUsers } from '@/config/demo-users';
import { loginInputSchema, useLogin } from '@/lib/auth';
import { type User } from '@/types/api';

const etiquetaDemo: Record<User['role'], string> = {
  titular: 'Titular',
  beneficiario: 'Beneficiario',
  tendero: 'Tendero',
};

type LoginFormProps = {
  onSuccess: (user: User) => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const login = useLogin({ onSuccess });

  return (
    <Form schema={loginInputSchema} onSubmit={(values) => login.mutate(values)}>
      {({ register, formState, setValue }) => (
        <>
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            placeholder="juan@paygent.dev"
            className="h-12 bg-paper text-base"
            error={formState.errors.email}
            registration={register('email')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            className="h-12 bg-paper text-base"
            error={formState.errors.password}
            registration={register('password')}
          />
          <FormError message={login.error?.message} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={login.isPending}
          >
            Iniciar sesión
            {!login.isPending && <ArrowRight aria-hidden="true" />}
          </Button>

          {/* Cuentas de la demo: un toque llena el formulario. */}
          <fieldset className="space-y-2">
            <legend className="text-xs text-ink-2">Cuentas de la demo</legend>
            <div className="grid grid-cols-3 gap-2">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setValue('email', u.email, { shouldValidate: true });
                    setValue('password', DEMO_PASSWORD, {
                      shouldValidate: true,
                    });
                  }}
                  className="min-h-12 rounded-lg border border-rule bg-paper px-2 text-sm text-grafito transition-colors hover:bg-paper-sunken focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {etiquetaDemo[u.role]}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </Form>
  );
};
