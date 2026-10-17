import { type Merchant, type Payout } from '@openroute/shared';
import { CheckCircle2, Clock, Store } from 'lucide-react';
import * as React from 'react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormError, Input, Select } from '@/components/ui/form';
import { useNotifications } from '@/components/ui/notifications';
import { cn } from '@/utils/cn';
import { formatCop, formatDate, formatTime } from '@/utils/format';

import { useAcreditaciones, useCambiarCobro } from '../api/cobros';

// Debajo de la caja: cómo cobra la tienda (y cambiarlo) y lo que Puntored le
// acreditó en su llave Bre-B cuando cobra sin wallet. Necesita señal.

const enmascarar = (llave: string) =>
  llave.length > 6 ? `${llave.slice(0, 3)}•••${llave.slice(-4)}` : llave;

export const describirCobro = (p?: Payout) =>
  p?.via === 'puntored'
    ? `Por Puntored a tu llave Bre-B ${enmascarar(p.llave)}`
    : 'Directo a tu wallet de Open Payments';

const cobroSchema = z
  .object({
    via: z.enum(['puntored', 'wallet']),
    llave: z.string().trim().optional(),
    wallet: z.string().trim().optional(),
  })
  .refine(
    (v) =>
      v.via !== 'puntored' ||
      /^(\+?57)?3\d{9}$/.test((v.llave ?? '').replace(/[\s-]/g, '')),
    { path: ['llave'], message: 'Un celular de 10 dígitos, ej. 310 555 0101' },
  )
  .refine(
    (v) =>
      v.via !== 'wallet' ||
      /^(\$|https:\/\/)[^\s/]+\.[^\s/]+\/\S+$/.test(v.wallet ?? ''),
    { path: ['wallet'], message: 'Tu wallet address, ej. $ilp.interledger-test.dev/tu-tienda' },
  );

// "+57 310 555 0101" → "3105550101"; "$ilp…" → "https://ilp…".
const aPayout = (v: z.output<typeof cobroSchema>): Payout =>
  v.via === 'puntored'
    ? { via: 'puntored', llave: (v.llave ?? '').replace(/\D/g, '').slice(-10) }
    : {
        via: 'wallet',
        wallet: v.wallet!.startsWith('$') ? `https://${v.wallet!.slice(1)}` : v.wallet!,
      };

const CambiarCobro = ({
  merchant,
  onListo,
}: {
  merchant: Merchant;
  onListo: (m: Merchant) => void;
}) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const cambiar = useCambiarCobro({
    mutationConfig: {
      onSuccess: (m) => {
        addNotification({ type: 'success', title: 'Listo', message: describirCobro(m.payout) });
        onListo(m);
      },
    },
  });
  return (
    <Form
      schema={cobroSchema}
      options={{
        defaultValues: {
          via: merchant.payout?.via ?? 'puntored',
          llave: merchant.payout?.via === 'puntored' ? merchant.payout.llave : '',
        },
      }}
      onSubmit={(v) => cambiar.mutate({ merchantId: merchant.id, payout: aPayout(v) })}
      className="space-y-3 pt-2"
    >
      {({ register, formState, watch }) => (
        <>
          <Select
            label="¿Cómo quieres recibir?"
            options={[
              { value: 'puntored', label: 'Por Puntored a mi llave Bre-B' },
              { value: 'wallet', label: 'En mi wallet de Open Payments' },
            ]}
            registration={register('via')}
          />
          {watch('via') === 'wallet' ? (
            <Input
              key="wallet"
              label="Wallet address"
              autoCapitalize="none"
              placeholder="$ilp.interledger-test.dev/tu-tienda"
              className="num"
              error={formState.errors.wallet}
              registration={register('wallet')}
            />
          ) : (
            <Input
              key="llave"
              label="Llave Bre-B (tu celular)"
              type="tel"
              error={formState.errors.llave}
              registration={register('llave')}
            />
          )}
          <FormError message={cambiar.error?.message} />
          <Button type="submit" className="w-full rounded-full" isLoading={cambiar.isPending}>
            Guardar
          </Button>
        </>
      )}
    </Form>
  );
};

export const MisCobros = ({ merchant: inicial }: { merchant: Merchant }) => {
  const [merchant, setMerchant] = React.useState(inicial);
  const [cambiando, setCambiando] = React.useState(false);
  const acreditaciones = useAcreditaciones(merchant.id);
  React.useEffect(() => setMerchant(inicial), [inicial]);
  const porPuntored = merchant.payout?.via === 'puntored';
  const lista = acreditaciones.data ?? [];

  return (
    <div className="space-y-6">
      <section aria-labelledby="como-cobras" className="space-y-2 rounded-3xl bg-paper-raised p-4">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="como-cobras" className="text-base font-medium text-grafito">
              ¿Cómo cobras?
            </h2>
            <p className="text-sm text-ink-2">{describirCobro(merchant.payout)}</p>
          </div>
          {!cambiando && (
            <button
              type="button"
              onClick={() => setCambiando(true)}
              className="min-h-10 shrink-0 rounded-full px-3 text-sm text-firma underline-offset-2 hover:underline"
            >
              Cambiar
            </button>
          )}
        </div>
        {cambiando && (
          <CambiarCobro
            merchant={merchant}
            onListo={(m) => {
              setMerchant(m);
              setCambiando(false);
            }}
          />
        )}
      </section>

      {(porPuntored || lista.length > 0) && (
        <section aria-labelledby="lo-que-recibiste" className="space-y-2">
          <h2 id="lo-que-recibiste" className="px-1 text-base font-medium text-grafito">
            Lo que te acreditó Puntored
          </h2>
          {lista.length === 0 ? (
            <p className="rounded-2xl bg-paper-raised p-4 text-sm text-ink-2">
              Cuando te paguen, aquí verás lo que Puntored te acredita en tu llave Bre-B.
            </p>
          ) : (
            <ul className="divide-y divide-rule rounded-3xl bg-paper-raised px-4">
              {lista.map((c) => {
                const ok = c.estado === 'acreditado';
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    {ok ? (
                      <CheckCircle2 className="size-5 shrink-0 text-liquidado" aria-hidden="true" />
                    ) : (
                      <Clock className="size-5 shrink-0 text-pendiente" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[0.9375rem]', ok ? 'text-grafito' : 'text-pendiente')}>
                        {ok
                          ? `Acreditado en tu llave ${c.llave}`
                          : c.estado === 'fallido'
                            ? 'Para retirar en tu punto Puntored'
                            : 'Acreditando…'}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {formatDate(c.creadoEn, { day: 'numeric', month: 'short' })} ·{' '}
                        {formatTime(c.creadoEn).slice(0, 5)}
                        {c.ref && <span className="num"> · {c.ref}</span>}
                        {c.comisionPesos > 0 && ` · comisión ${formatCop(c.comisionPesos)}`}
                      </span>
                    </span>
                    <span className="cifra text-[0.9375rem] text-grafito">
                      {formatCop(c.pesos - c.comisionPesos)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-1 text-xs text-ink-3">
            El pago llega de verdad a la cuenta de Puntored; la acreditación a tu llave está simulada en esta demo.
          </p>
        </section>
      )}
    </div>
  );
};
