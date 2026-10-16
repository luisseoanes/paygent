import { Copy, GitBranchPlus } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Form, Input } from '@/components/ui/form';
import { modoInfo } from '@/config/modos';
import { paths } from '@/config/paths';
import { type MandateTree, type ModeView } from '@/types/api';

import {
  type RegisterBeneficiaryValues,
  createRegisterBeneficiaryInputSchema,
  useRegisterBeneficiary,
} from '../api/register-beneficiary';
import {
  amountToNumber,
  disponibleParaDelegar,
  money,
  toAmount,
} from '../utils/mandate';

// Registrar un beneficiario: el titular solo decide cómo lo ve (alias), cuánto puede gastar por periodo, su PIN
// y cuánto sin señal. Sale siempre de su raíz: no se elige de dónde. Al terminar, el código para enlazar.

export type DelegarRamaProps = {
  root: MandateTree;
  // Compatibilidad con quien abre el formulario desde una rama: el beneficiario sale igual de la raíz.
  parentId?: string;
  onDone: () => void;
};

const CodigoParaEnlazar = ({
  code,
  modes = [],
  onDone,
}: {
  code: string;
  modes?: ModeView[];
  onDone: () => void;
}) => {
  const url = `${window.location.origin}${paths.enlazar.getHref(code)}`;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-2">
        Dale este código a tu beneficiario. Lo escribe en{' '}
        <strong>Enlazar</strong> y crea su cuenta.
      </p>
      <p
        className="num rounded-2xl bg-paper-sunken px-4 py-3 text-center text-xl text-grafito select-all"
        aria-label="Código para enlazar"
      >
        {code}
      </p>
      {modes.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-grafito">Ya puede pagar por:</p>
          <ul className="space-y-1 text-sm text-ink-2">
            {modes.map((m) => (
              <li key={m.mode} className="flex justify-between gap-3">
                <span>{modoInfo[m.mode].nombre}</span>
                <span className="cifra">
                  {money(amountToNumber(m.maxDebit))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-2">
            Puedes cambiar estos topes o quitar un modo desde su rama.
          </p>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        icon={<Copy aria-hidden="true" />}
        onClick={() => navigator.clipboard?.writeText(url).catch(() => {})}
      >
        Copiar enlace
      </Button>
      <Button type="button" onClick={onDone}>
        Listo
      </Button>
    </div>
  );
};

export const DelegarRama = ({ root, onDone }: DelegarRamaProps) => {
  const disponible = disponibleParaDelegar(root);
  const schema = createRegisterBeneficiaryInputSchema(disponible);
  const [alta, setAlta] = React.useState<{
    code: string;
    modes?: ModeView[];
  } | null>(null);
  const registrar = useRegisterBeneficiary({
    mutationConfig: { onSuccess: (res) => setAlta(res) },
  });

  if (alta)
    return (
      <CodigoParaEnlazar code={alta.code} modes={alta.modes} onDone={onDone} />
    );

  const submit = (values: RegisterBeneficiaryValues) =>
    registrar.mutate({
      rootMandateId: root.id,
      data: {
        alias: values.alias,
        maxDebit: toAmount(values.maxDebit, root.maxDebit),
        offlineCap: toAmount(values.offlineCap, root.maxDebit),
        pin: values.pin,
      },
    });

  return (
    <Form
      schema={schema}
      onSubmit={submit}
      options={{
        defaultValues: { alias: '', maxDebit: '', pin: '', offlineCap: '' },
      }}
    >
      {({ register, formState }) => (
        <>
          <p className="cifra -mb-2 text-xs text-ink-2">
            Disponible para repartir: {money(disponible)}
          </p>
          <Input
            label="Nombre"
            description="Cómo lo verás en tu panel"
            autoComplete="off"
            placeholder="Mamá"
            className="h-12 bg-paper text-base"
            error={formState.errors.alias}
            registration={register('alias')}
          />
          <Input
            label={`Tope por periodo (${root.maxDebit.assetCode})`}
            inputMode="decimal"
            autoComplete="off"
            className="num h-12 bg-paper text-base"
            error={formState.errors.maxDebit}
            registration={register('maxDebit')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="PIN"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.pin}
              registration={register('pin')}
            />
            <Input
              label="Tope sin señal"
              inputMode="decimal"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.offlineCap}
              registration={register('offlineCap')}
            />
          </div>
          <p className="text-xs text-ink-2">
            Todo sale de tu cuenta. Se renueva y vence igual que tu mandato.
            Queda habilitado para pagar con su celular (QR, con o sin señal),
            con el Asistente en la app y por SMS; el tope se reparte entre ellos
            y luego lo ajustas.
          </p>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={registrar.isPending}
            icon={<GitBranchPlus aria-hidden="true" />}
          >
            Delegar
          </Button>
        </>
      )}
    </Form>
  );
};
