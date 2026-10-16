import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormError, Input } from '@/components/ui/form';
import { registroTitularSchema, useRegistrarTitular } from '@/lib/auth';
import { type User } from '@/types/api';

// Registro del titular: la persona que tiene wallet y delega pagos. Su wallet
// address es la que se usa al firmar el mandato raíz en Open Payments.

const campo = 'h-12 bg-paper text-base';

export const RegistroTitularForm = ({
  onSuccess,
}: {
  onSuccess: (user: User) => void;
}) => {
  const registrar = useRegistrarTitular({ onSuccess });

  return (
    <Form
      schema={registroTitularSchema}
      onSubmit={(values) => registrar.mutate(values)}
      className="space-y-4"
    >
      {({ register, formState }) => (
        <>
          <Input
            label="Número de documento"
            inputMode="numeric"
            autoComplete="off"
            className={campo}
            error={formState.errors.documento}
            registration={register('documento')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              autoComplete="given-name"
              className={campo}
              error={formState.errors.nombre}
              registration={register('nombre')}
            />
            <Input
              label="Apellido"
              autoComplete="family-name"
              className={campo}
              error={formState.errors.apellido}
              registration={register('apellido')}
            />
          </div>
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            className={campo}
            error={formState.errors.email}
            registration={register('email')}
          />
          <Input
            label="Celular"
            type="tel"
            autoComplete="tel"
            placeholder="+57 300 000 0000"
            className={campo}
            error={formState.errors.telefono}
            registration={register('telefono')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            className={campo}
            error={formState.errors.password}
            registration={register('password')}
          />
          <Input
            label="Wallet address (Open Payments)"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="$ilp.interledger-test.dev/tu-nombre"
            description="La pública, la que compartes para recibir pagos."
            className={`num ${campo}`}
            error={formState.errors.walletAddress}
            registration={register('walletAddress')}
          />
          <FormError message={registrar.error?.message} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={registrar.isPending}
          >
            Crear mi cuenta
            {!registrar.isPending && <ArrowRight aria-hidden="true" />}
          </Button>
        </>
      )}
    </Form>
  );
};
