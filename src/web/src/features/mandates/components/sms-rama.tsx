import { MessageSquareText, PhoneOff } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Form, Input } from '@/components/ui/form';
import { useNotifications } from '@/components/ui/notifications';
import { Spinner } from '@/components/ui/spinner';
import { env } from '@/config/env';

import {
  type ActivarSmsValues,
  activarSmsInputSchema,
  useActivarSms,
  useApagarSms,
  useSmsRama,
} from '../api/sms-rama';

// SMS de una rama: el titular registra el celular de su beneficiario y el PIN con el que confirma las compras que
// le pide al Asistente. El PIN nunca se vuelve a mostrar; el número, enmascarado.

const FormularioSms = ({
  mandateId,
  onDone,
}: {
  mandateId: string;
  onDone: () => void;
}) => {
  const activar = useActivarSms({ mutationConfig: { onSuccess: onDone } });
  return (
    <Form
      schema={activarSmsInputSchema}
      onSubmit={(v: ActivarSmsValues) =>
        activar.mutate({ mandateId, data: { phone: v.phone, pin: v.pin } })
      }
      options={{ defaultValues: { phone: '', pin: '', confirm: '' } }}
    >
      {({ register, formState }) => (
        <>
          <Input
            label="Celular"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="300 111 2233"
            className="num h-12 bg-paper text-base"
            error={formState.errors.phone}
            registration={register('phone')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="PIN"
              description="4 números, nada obvio"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.pin}
              registration={register('pin')}
            />
            <Input
              label="Confirma el PIN"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.confirm}
              registration={register('confirm')}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            isLoading={activar.isPending}
          >
            Activar
          </Button>
        </>
      )}
    </Form>
  );
};

export const SmsRama = ({
  mandateId,
  nombre,
}: {
  mandateId: string;
  nombre: string;
}) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const [editando, setEditando] = React.useState(false);
  const sms = useSmsRama({ mandateId });
  const apagar = useApagarSms({
    mutationConfig: {
      onSuccess: () =>
        addNotification({ type: 'success', title: `SMS de ${nombre} apagado` }),
    },
  });

  const estado = sms.data;
  return (
    <section
      aria-labelledby={`sms-${mandateId}`}
      className="space-y-3 rounded-2xl bg-paper-sunken/60 p-4"
    >
      <h3
        id={`sms-${mandateId}`}
        className="flex items-center gap-2 text-sm font-medium text-grafito"
      >
        <MessageSquareText aria-hidden="true" className="size-4" />
        SMS con el Asistente
      </h3>

      {sms.isPending ? (
        <Spinner size="sm" />
      ) : sms.isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            No pudimos ver el SMS de esta rama.
          </p>
          <Button size="sm" variant="outline" onClick={() => sms.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : editando ? (
        <FormularioSms
          mandateId={mandateId}
          onDone={() => {
            setEditando(false);
            addNotification({
              type: 'success',
              title: `SMS de ${nombre} activo`,
            });
          }}
        />
      ) : estado?.active ? (
        <>
          <p className="text-sm text-ink-2">
            {nombre} le escribe al Asistente desde{' '}
            <span className="num text-grafito">{estado.phone}</span> y confirma
            cada compra con su PIN.
          </p>
          {env.SMS_GATEWAY_NUMBER && (
            <p className="text-sm text-ink-2">
              Número para escribir:{' '}
              <span className="num text-grafito select-all">
                {env.SMS_GATEWAY_NUMBER}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditando(true)}
            >
              Cambiar número o PIN
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<PhoneOff aria-hidden="true" />}
              isLoading={apagar.isPending}
              onClick={() => apagar.mutate({ mandateId })}
            >
              Apagar SMS
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Sin internet, {nombre} puede pedirle compras al Asistente por SMS
            desde un celular de teclas.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
            Activar SMS
          </Button>
        </>
      )}
    </section>
  );
};
