import { GitBranchPlus } from 'lucide-react';
import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { CheckboxGroup, Form, Input, Select } from '@/components/ui/form';
import { useNotifications } from '@/components/ui/notifications';
import { type MandateTree } from '@/types/api';

import {
  type DelegateFormInput,
  type DelegateFormValues,
  type PadreDelegable,
  createDelegateInputSchema,
  useDelegateMandate,
} from '../api/delegate-mandate';
import {
  categoryLabels,
  disponibleParaDelegar,
  findNode,
  holderTypeLabel,
  money,
  ramasDelegables,
  toAmount,
} from '../utils/mandate';

// Formulario para crear una rama hija. Muestra lo que la rama de origen aún
// puede repartir y solo ofrece sus categorías: la UI no deja pedir más de lo
// que el gateway aceptaría (GW-03).

const quienLaUsa: Record<DelegateFormValues['holderType'], string> = {
  person: 'Teléfono o wallet (ej. +57 300 555 0142)',
  agent: 'Id del agente (ej. agent_asistente)',
  device: 'Id del celular (ej. celular-maria)',
};

// Al cambiar la rama de origen, las categorías vuelven a las del padre.
const CategoriasDelPadre = ({ padres }: { padres: PadreDelegable[] }) => {
  const { control, register, setValue, formState } =
    useFormContext<DelegateFormInput>();
  const parentId = useWatch({ control, name: 'parentId' });
  const padre = padres.find((p) => p.id === parentId);
  const primeraVez = React.useRef(true);

  React.useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    setValue('categories', padre?.categories ?? []);
  }, [padre, setValue]);

  return (
    <CheckboxGroup
      label="Puede gastar en"
      options={(padre?.categories ?? []).map((c) => ({
        value: c,
        label: categoryLabels[c],
      }))}
      error={formState.errors.categories}
      registration={register('categories')}
    />
  );
};

const AyudaDisponible = ({ padres }: { padres: PadreDelegable[] }) => {
  const parentId = useWatch<DelegateFormInput, 'parentId'>({
    name: 'parentId',
  });
  const padre = padres.find((p) => p.id === parentId);
  if (!padre) return null;
  return (
    <p className="cifra -mt-2 text-xs text-ink-2">
      Disponible para repartir: {money(padre.disponible)}
    </p>
  );
};

export type DelegarRamaProps = {
  root: MandateTree;
  parentId?: string;
  onDone: () => void;
};

export const DelegarRama = ({ root, parentId, onDone }: DelegarRamaProps) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const ramas = ramasDelegables(root);
  const padres: PadreDelegable[] = ramas.map((n) => ({
    id: n.id,
    disponible: disponibleParaDelegar(n),
    categories: n.categories,
  }));
  const schema = createDelegateInputSchema(padres);
  const inicial = padres.find((p) => p.id === parentId) ?? padres[0];

  const delegar = useDelegateMandate({
    mutationConfig: {
      onSuccess: (_mandate, { data }) => {
        addNotification({
          type: 'success',
          title: `Rama ${data.holderName} creada`,
          message: 'Ya aparece en tus delegados.',
        });
        onDone();
      },
    },
  });

  if (!inicial)
    return (
      <p className="text-sm text-ink-2">
        No hay ninguna rama activa desde la que delegar.
      </p>
    );

  const submit = (values: DelegateFormValues) => {
    const padre = findNode(root, values.parentId);
    if (!padre) return;
    const like = padre.maxDebit;
    delegar.mutate({
      mandateId: values.parentId,
      data: {
        holderType: values.holderType,
        holderId: values.holderId,
        holderName: values.holderName,
        maxDebit: toAmount(values.maxDebit, like),
        categories: values.categories,
        pinThreshold:
          values.pinThreshold !== undefined
            ? toAmount(values.pinThreshold, like)
            : undefined,
        offlineCap:
          values.offlineCap !== undefined
            ? toAmount(values.offlineCap, like)
            : undefined,
      },
    });
  };

  return (
    <Form
      schema={schema}
      onSubmit={submit}
      options={{
        defaultValues: {
          parentId: inicial.id,
          holderType: 'person',
          holderName: '',
          holderId: '',
          maxDebit: '',
          categories: inicial.categories,
          pinThreshold: '',
          offlineCap: '',
        },
      }}
    >
      {({ register, formState, watch }) => (
        <>
          <Select
            label="Sale de"
            className="h-12 bg-paper text-base"
            options={ramas.map((n) => ({
              value: n.id,
              label: n.parentId ? n.holderName : `${n.holderName} (raíz)`,
            }))}
            error={formState.errors.parentId}
            registration={register('parentId')}
          />
          <AyudaDisponible padres={padres} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Es"
              className="h-12 bg-paper text-base"
              options={(['person', 'agent', 'device'] as const).map((t) => ({
                value: t,
                label: holderTypeLabel[t],
              }))}
              error={formState.errors.holderType}
              registration={register('holderType')}
            />
            <Input
              label="Nombre"
              autoComplete="off"
              placeholder="Doña Rosa"
              className="h-12 bg-paper text-base"
              error={formState.errors.holderName}
              registration={register('holderName')}
            />
          </div>

          <Input
            label="Quién la usa"
            autoComplete="off"
            description={quienLaUsa[watch('holderType')]}
            className="h-12 bg-paper text-base"
            error={formState.errors.holderId}
            registration={register('holderId')}
          />

          <Input
            label={`Tope por periodo (${root.maxDebit.assetCode})`}
            inputMode="decimal"
            autoComplete="off"
            className="num h-12 bg-paper text-base"
            error={formState.errors.maxDebit}
            registration={register('maxDebit')}
          />

          <CategoriasDelPadre padres={padres} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Pedir PIN desde (opcional)"
              inputMode="decimal"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.pinThreshold}
              registration={register('pinThreshold')}
            />
            <Input
              label="Tope sin señal (opcional)"
              inputMode="decimal"
              autoComplete="off"
              className="num h-12 bg-paper text-base"
              error={formState.errors.offlineCap}
              registration={register('offlineCap')}
            />
          </div>

          <p className="text-xs text-ink-2">
            Se renueva igual que la rama de origen y vence cuando ella vence.
          </p>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={delegar.isPending}
            icon={<GitBranchPlus aria-hidden="true" />}
          >
            Delegar
          </Button>
        </>
      )}
    </Form>
  );
};
