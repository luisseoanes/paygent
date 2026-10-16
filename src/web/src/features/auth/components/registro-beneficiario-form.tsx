import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormError, Input } from '@/components/ui/form';
import {
  registroBeneficiarioSchema,
  useRegistrarBeneficiario,
} from '@/lib/auth';
import { type User } from '@/types/api';

// Registro del beneficiario: solo después de enlazar el celular con el código
// del titular. No pide wallet: paga con lo que le delegaron.

const campo = 'h-12 bg-paper text-base';

export const RegistroBeneficiarioForm = ({
  mandateId,
  onSuccess,
}: {
  // La rama a la que quedó enlazado el celular
  mandateId: string;
  onSuccess: (user: User) => void;
}) => {
  const registrar = useRegistrarBeneficiario({ onSuccess });

  return (
    <Form
      schema={registroBeneficiarioSchema}
      onSubmit={(values) => registrar.mutate({ ...values, mandateId })}
      className="space-y-4"
    >
      {({ register, formState }) => (
        <>
          <Input
            label="Nombre"
            autoComplete="name"
            className={campo}
            error={formState.errors.nombre}
            registration={register('nombre')}
          />
          <Input
            label="Número de documento"
            inputMode="numeric"
            autoComplete="off"
            className={campo}
            error={formState.errors.documento}
            registration={register('documento')}
          />
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            className={campo}
            error={formState.errors.email}
            registration={register('email')}
          />
          <Input
            label="Teléfono"
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
          <FormError message={registrar.error?.message} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={registrar.isPending}
          >
            Terminar registro
            {!registrar.isPending && <ArrowRight aria-hidden="true" />}
          </Button>
        </>
      )}
    </Form>
  );
};
