import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormError, Input, Select } from '@/components/ui/form';
import {
  categoriasTienda,
  registroTenderoSchema,
  useRegistrarTendero,
} from '@/lib/auth';
import { type User } from '@/types/api';

// Registro del tendero: su cuenta y su tienda. Sin wallet cobra por Puntored a
// su llave Bre-B (por defecto, su celular); con wallet, directo en ella.

const campo = 'h-12 bg-paper text-base';

const categoriaLabel: Record<(typeof categoriasTienda)[number], string> = {
  mercado: 'Mercado y abarrotes',
  farmacia: 'Farmacia o droguería',
  efectivo: 'Punto de retiro de efectivo',
};

export const RegistroTenderoForm = ({
  onSuccess,
}: {
  onSuccess: (user: User) => void;
}) => {
  const registrar = useRegistrarTendero({ onSuccess });

  return (
    <Form
      schema={registroTenderoSchema}
      options={{ defaultValues: { cobro: 'puntored', categoria: 'mercado' } }}
      onSubmit={(values) => registrar.mutate(values)}
      className="space-y-4"
    >
      {({ register, formState, watch }) => (
        <>
          <Input
            label="Nombre de tu tienda"
            autoComplete="organization"
            className={campo}
            error={formState.errors.tienda}
            registration={register('tienda')}
          />
          <Select
            label="¿Qué vendes?"
            className={campo}
            options={categoriasTienda.map((c) => ({
              value: c,
              label: categoriaLabel[c],
            }))}
            error={formState.errors.categoria}
            registration={register('categoria')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tu nombre"
              autoComplete="given-name"
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
          </div>
          <Input
            label="Celular"
            type="tel"
            autoComplete="tel"
            placeholder="+57 310 000 0000"
            className={campo}
            error={formState.errors.telefono}
            registration={register('telefono')}
          />
          <Select
            label="¿Cómo quieres recibir la plata?"
            className={campo}
            options={[
              {
                value: 'puntored',
                label: 'Por Puntored a mi llave Bre-B (no necesito wallet)',
              },
              { value: 'wallet', label: 'En mi wallet de Open Payments' },
            ]}
            error={formState.errors.cobro}
            registration={register('cobro')}
          />
          {watch('cobro') === 'wallet' ? (
            <Input
              key="wallet"
              label="Wallet address (Open Payments)"
              autoComplete="off"
              autoCapitalize="none"
              placeholder="$ilp.interledger-test.dev/tu-tienda"
              className={`num ${campo}`}
              error={formState.errors.wallet}
              registration={register('wallet')}
            />
          ) : (
            <Input
              key="llave"
              label="Llave Bre-B (opcional)"
              type="tel"
              placeholder="La de tu celular"
              description="Si la dejas vacía, Puntored te acredita a la llave de tu celular."
              className={campo}
              error={formState.errors.llave}
              registration={register('llave')}
            />
          )}
          <Input
            label="Correo"
            type="email"
            autoComplete="email"
            className={campo}
            error={formState.errors.email}
            registration={register('email')}
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
            Registrar mi tienda
            {!registrar.isPending && <ArrowRight aria-hidden="true" />}
          </Button>
        </>
      )}
    </Form>
  );
};
