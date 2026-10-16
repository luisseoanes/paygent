import { ArrowUpRight } from 'lucide-react';

import cielo from '@/assets/paisaje-cielo.png';
import { MarcaDeAutenticidad } from '@/components/brand/marca-autenticidad';
import { Button } from '@/components/ui/button';
import { Form, Input, Select } from '@/components/ui/form';
import { redirectTo } from '@/utils/redirect';

import {
  createRootMandateInputSchema,
  toRootMandateBody,
  useCreateRootMandate,
} from '../api/create-root-mandate';
import { periodoLabel, periodos } from '../utils/mandate';

// Juan aún no tiene mandato (o lo revocó): elige el tope y el periodo y lo
// firma en su billetera. El gateway pide el grant interactivo y aquí solo
// redirigimos a la pantalla de consentimiento del Test Wallet.

const PASOS = [
  'Eliges cuánto pueden gastar entre todos y cada cuánto se renueva.',
  'Lo apruebas en tu billetera. Nadie más ve tu llave.',
  'Vuelves aquí y repartes ese tope entre tu familia y tus agentes.',
];

export type FirmarMandatoProps = {
  walletAddress?: string;
  // El gateway corre sin Test Wallet (MOCK_OP)
  simulado?: boolean;
  // Ya hubo un mandato y Juan lo revocó
  revocado?: boolean;
};

export const FirmarMandato = ({
  walletAddress,
  simulado = false,
  revocado = false,
}: FirmarMandatoProps) => {
  const createRoot = useCreateRootMandate({
    mutationConfig: {
      onSuccess: ({ redirectUrl }) => redirectTo(redirectUrl),
    },
  });
  // Tras el éxito el navegador se va: el botón sigue ocupado hasta entonces.
  const ocupado = createRoot.isPending || createRoot.isSuccess;

  return (
    <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-xl border border-rule bg-paper-raised shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-18px_rgb(28_34_48/0.25)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative min-h-40 overflow-hidden">
        <img
          src={cielo}
          alt=""
          width={320}
          height={180}
          className="absolute inset-0 h-full w-full object-cover object-[50%_30%] pixelado"
        />
        <div className="absolute inset-0 bg-linear-to-t from-grafito/60 to-grafito/5" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-5 text-paper-raised">
          <ol className="space-y-2.5 text-sm">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex gap-2.5">
                <span className="cifra mt-px shrink-0 opacity-80">
                  {i + 1}.
                </span>
                <span className="opacity-95">{paso}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-6">
        <div className="space-y-1.5">
          <h2 className="font-heading text-2xl leading-tight font-semibold text-grafito">
            {revocado ? 'Firma un mandato nuevo' : 'Firma tu mandato'}
          </h2>
          <p className="text-sm text-ink-2">
            {revocado
              ? 'Revocaste el anterior: ninguna rama puede gastar hasta que firmes otro.'
              : 'Un solo permiso en tu billetera. Después lo repartes como quieras.'}
          </p>
        </div>

        <Form
          schema={createRootMandateInputSchema}
          options={{ defaultValues: { maxDebit: '300', periodo: 'mes' } }}
          onSubmit={(values) =>
            createRoot.mutate(toRootMandateBody(values, walletAddress))
          }
        >
          {({ register, formState }) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tope entre todos (USD)"
                  inputMode="decimal"
                  autoComplete="off"
                  className="num h-12 bg-paper text-base"
                  error={formState.errors.maxDebit}
                  registration={register('maxDebit')}
                />
                <Select
                  label="Se renueva"
                  className="h-12 bg-paper text-base"
                  options={periodos.map((p) => ({
                    value: p,
                    label: periodoLabel[p],
                  }))}
                  error={formState.errors.periodo}
                  registration={register('periodo')}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                isLoading={ocupado}
                icon={<ArrowUpRight aria-hidden="true" />}
              >
                Firmar en mi billetera
              </Button>
            </>
          )}
        </Form>

        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <MarcaDeAutenticidad
            kind={simulado ? 'simulado' : 'real'}
            label={simulado ? 'Grant simulado' : 'Grant · testnet'}
          />
          {walletAddress ? (
            <span className="num truncate">{walletAddress}</span>
          ) : (
            'Te llevamos a tu billetera para aprobarlo.'
          )}
        </p>
      </div>
    </div>
  );
};
