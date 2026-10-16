import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, Input } from '@/components/ui/form';
import { loginInputSchema, useLogin } from '@/lib/auth';

type LoginFormProps = {
  onSuccess: () => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const login = useLogin({ onSuccess });

  return (
    <Form schema={loginInputSchema} onSubmit={(values) => login.mutate(values)}>
      {({ register, formState }) => (
        <>
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            placeholder="juan@correo.com"
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
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={login.isPending}
          >
            Iniciar sesión
            {!login.isPending && <ArrowRight aria-hidden="true" />}
          </Button>
        </>
      )}
    </Form>
  );
};
