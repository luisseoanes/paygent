import {
  GitBranchPlus,
  Minus,
  Pause,
  Play,
  Plus,
  QrCode,
  Scissors,
  WifiOff,
} from 'lucide-react';
import * as React from 'react';

import { ReglaDeConsumo } from '@/components/brand/regla-consumo';
import { Sello } from '@/components/brand/sello';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { useNotifications } from '@/components/ui/notifications';
import { type FeedEvent, type MandateTree } from '@/types/api';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

import { useRestrictMandate } from '../api/restrict-mandate';
import { useRevokeMandate } from '../api/revoke-mandate';
import { useUnfreezeMandate } from '../api/unfreeze-mandate';
import {
  amountToNumber,
  categoryLabels,
  flattenTree,
  intervalLabel,
  money,
  nextRenewal,
  quedanDe,
  statusOf,
  subtreeIds,
  toAmount,
} from '../utils/mandate';

import { Libreta } from './libreta';
import { SmsRama } from './sms-rama';
import { VincularCelular } from './vincular-celular';

// Detalle de una rama: cuánto le queda, las acciones de Juan a un toque
// (congelar, tope sin señal, delegar, revocar), sus reglas y sus últimos
// movimientos. La monotonía se ve en la interfaz: el tope sin señal solo baja.

type AccionRapidaProps = React.ComponentProps<'button'> & {
  icon: React.ReactNode;
  label: string;
  tone?: 'default' | 'anulado' | 'activo';
};

const AccionRapida = ({
  icon,
  label,
  tone = 'default',
  className,
  ...props
}: AccionRapidaProps) => (
  <button
    type="button"
    className={cn(
      'group flex w-18 min-w-0 flex-col items-center gap-1.5 rounded-2xl py-1 text-xs text-grafito focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-14 items-center justify-center rounded-full transition-colors [&_svg]:size-5',
        tone === 'anulado'
          ? 'bg-anulado-tint text-anulado group-hover:bg-anulado group-hover:text-paper-raised'
          : tone === 'activo'
            ? 'bg-grafito text-paper-raised'
            : 'bg-paper-sunken text-grafito group-hover:bg-hueso-2',
      )}
    >
      {icon}
    </span>
    <span className="leading-tight">{label}</span>
  </button>
);

const StepperSoloBaja = ({
  value,
  step,
  onLower,
  label,
  isLoading,
}: {
  value: number;
  step: number;
  onLower: (next: number) => void;
  label: string;
  isLoading?: boolean;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label="Bajar tope sin señal"
        disabled={value - step < 0 || isLoading}
        onClick={() => onLower(value - step)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <output
        aria-live="polite"
        className="cifra flex h-12 min-w-28 flex-1 items-center justify-center rounded-full bg-paper-raised px-3 text-xl"
      >
        {money(value)}
      </output>
      <span title="Ampliar exige que firmes un mandato nuevo">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          disabled
          aria-label="Subir tope (no disponible: ampliar exige firmar un mandato nuevo)"
        >
          <Plus aria-hidden="true" />
        </Button>
      </span>
    </div>
    <p className="text-xs text-ink-2">
      Solo baja. Para subirlo tendrías que firmar un mandato nuevo en tu
      billetera.
    </p>
  </div>
);

const Dato = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline justify-between gap-4 py-3">
    <dt className="shrink-0 text-sm text-ink-2">{label}</dt>
    <dd className="min-w-0 text-right text-sm text-grafito">{children}</dd>
  </div>
);

export type RamaDetalleProps = {
  node: MandateTree;
  root: MandateTree;
  parent?: MandateTree;
  events: FeedEvent[];
  // Abre el formulario de delegar con esta rama como origen
  onDelegate?: () => void;
};

export const RamaDetalle = ({
  node,
  root,
  parent,
  events,
  onDelegate,
}: RamaDetalleProps) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const [topeAbierto, setTopeAbierto] = React.useState(false);
  const restrict = useRestrictMandate();
  const unfreeze = useUnfreezeMandate({
    mutationConfig: {
      onSuccess: () =>
        addNotification({
          type: 'success',
          title: `${node.holderName} puede volver a gastar`,
        }),
    },
  });
  const revoke = useRevokeMandate({
    mutationConfig: {
      onSuccess: () =>
        addNotification({
          type: 'success',
          title: `Rama ${node.holderName} revocada`,
          message: 'El resto del árbol sigue funcionando.',
        }),
    },
  });

  const status = statusOf(node);
  const affected = subtreeIds(node);
  const stillActive = flattenTree(root)
    .map((f) => f.node)
    .filter((n) => !affected.includes(n.id) && statusOf(n) === 'active');
  const restringe = !node.canSpend;
  const limit = amountToNumber(node.maxDebit);
  const spent = amountToNumber(node.spentInPeriod);
  const offlineCap = node.offlineCap
    ? amountToNumber(node.offlineCap)
    : undefined;
  const parentRemaining = parent ? quedanDe(parent) : undefined;
  const renueva = nextRenewal(node.interval);
  // El SMS lo usa una persona (o el celular de una persona), nunca un agente ni la raíz.
  const puedeSms =
    !!node.parentId &&
    status !== 'revoked' &&
    node.canSpend &&
    node.holderType !== 'agent';
  const puedeDelegar =
    onDelegate &&
    status === 'active' &&
    node.canSpend &&
    node.holderType !== 'device';

  return (
    <div className="space-y-7">
      {status !== 'active' && (
        <div className="flex items-center gap-4 rounded-2xl bg-anulado-tint/50 p-4">
          <Sello
            variant={status === 'revoked' ? 'anulado' : 'congelado'}
            size="sm"
            seed={node.id}
          />
          <p className="text-sm text-grafito">
            {status === 'revoked'
              ? 'Esta rama ya no puede gastar. El resto de tu árbol sigue igual.'
              : 'Está en pausa: ningún pago pasa hasta que la reactives.'}
          </p>
        </div>
      )}

      {restringe ? (
        <p className="text-[0.9375rem] leading-relaxed text-grafito">
          No tiene dinero: su tope es <strong>$0</strong>. Vigila tus ramas y
          solo puede restringir (congelar, bajar topes sin señal, explicar).
          Cada cosa que hace queda en tu libreta.
        </p>
      ) : (
        <section aria-label="Saldo de la rama" className="space-y-3">
          <div>
            <p className="text-sm text-ink-2">Quedan</p>
            <p className="cifra text-5xl leading-none font-light tracking-[-0.03em] text-grafito">
              {money(quedanDe(node))}
            </p>
            <p className="mt-2 text-sm text-ink-2">
              de <span className="cifra">{money(limit)}</span>{' '}
              {intervalLabel(node.interval)}
            </p>
          </div>
          <ReglaDeConsumo
            spent={spent}
            limit={limit}
            parentRemaining={parentRemaining}
            tone={node.holderType === 'agent' ? 'agente' : 'firma'}
            label={`Consumo de ${node.holderName}`}
          />
        </section>
      )}

      {status !== 'revoked' && (
        <section
          aria-label="Acciones"
          className="flex justify-around gap-1 border-y border-rule py-4"
        >
          {status === 'active' ? (
            <AccionRapida
              icon={<Pause />}
              label="Congelar"
              disabled={restrict.isPending}
              onClick={() =>
                restrict.mutate({ mandateId: node.id, data: { frozen: true } })
              }
            />
          ) : (
            <AccionRapida
              icon={<Play />}
              label="Reactivar"
              tone="activo"
              disabled={unfreeze.isPending}
              onClick={() => unfreeze.mutate({ mandateId: node.id })}
            />
          )}
          {offlineCap !== undefined && (
            <AccionRapida
              icon={<WifiOff />}
              label="Sin señal"
              aria-expanded={topeAbierto}
              aria-controls="tope-sin-senal"
              tone={topeAbierto ? 'activo' : 'default'}
              onClick={() => setTopeAbierto((v) => !v)}
            />
          )}
          {node.holderType === 'device' && node.offlineCap && (
            <VincularCelular
              mandateId={node.id}
              nombre={node.holderName}
              trigger={<AccionRapida icon={<QrCode />} label="Vincular" />}
            />
          )}
          {puedeDelegar && (
            <AccionRapida
              icon={<GitBranchPlus />}
              label="Delegar"
              onClick={onDelegate}
            />
          )}
          <ConfirmationDialog
            title={`¿Revocar a ${node.holderName}?`}
            body="Su rama queda tachada y no puede volver a gastar. El resto de tu árbol sigue activo."
            confirmLabel="Revocar rama"
            isLoading={revoke.isPending}
            isDone={revoke.isSuccess}
            onConfirm={() => revoke.mutate({ mandateId: node.id })}
            triggerButton={
              <AccionRapida
                icon={<Scissors />}
                label="Revocar"
                tone="anulado"
              />
            }
          >
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-anulado-tint p-3">
                <p className="text-xs font-medium text-anulado">Se revocan</p>
                <ul className="mt-1 space-y-0.5 text-grafito">
                  {[node, ...flattenTree(node).map((f) => f.node)].map((n) => (
                    <li key={n.id} className="line-through decoration-anulado">
                      {n.holderName}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-liquidado-tint p-3">
                <p className="text-xs font-medium text-liquidado">
                  Siguen activos
                </p>
                <ul className="mt-1 space-y-0.5 text-grafito">
                  {stillActive.map((n) => (
                    <li key={n.id}>{n.holderName}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ConfirmationDialog>
        </section>
      )}

      {topeAbierto && offlineCap !== undefined && node.offlineCap && (
        <section
          id="tope-sin-senal"
          aria-label="Tope sin señal"
          className="animate-in space-y-3 rounded-2xl bg-paper-sunken/60 p-4 fade-in-0 slide-in-from-top-1"
        >
          <h3 className="text-sm font-medium text-grafito">Tope sin señal</h3>
          <StepperSoloBaja
            value={offlineCap}
            step={offlineCap >= 20 ? 5 : 1}
            label={`Tope sin señal de ${node.holderName}`}
            isLoading={restrict.isPending}
            onLower={(next) =>
              restrict.mutate({
                mandateId: node.id,
                data: { offlineCap: toAmount(next, node.offlineCap!) },
              })
            }
          />
        </section>
      )}

      {puedeSms && <SmsRama mandateId={node.id} nombre={node.holderName} />}

      <dl className="divide-y divide-rule">
        {!restringe && (
          <Dato label="Puede gastar en">
            {node.categories.length
              ? node.categories.map((c) => categoryLabels[c]).join(', ')
              : 'Nada'}
          </Dato>
        )}
        {!restringe && (
          <Dato label="Pide PIN">
            {node.pinThreshold
              ? amountToNumber(node.pinThreshold) === 0
                ? 'En cada compra'
                : `Desde ${money(amountToNumber(node.pinThreshold))}`
              : 'No'}
          </Dato>
        )}
        {offlineCap !== undefined && (
          <Dato label="Sin señal">
            <span className="cifra">Hasta {money(offlineCap)}</span>
          </Dato>
        )}
        {!restringe && renueva && (
          <Dato label="Se renueva">
            {formatDate(renueva, { day: 'numeric', month: 'long' })}
          </Dato>
        )}
        <Dato label="Vence">
          {formatDate(node.expiresAt, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Dato>
        <Dato label="La usa">
          <span className="block truncate">{node.holderId}</span>
        </Dato>
      </dl>

      <section aria-labelledby="ultimos" className="space-y-2">
        <h3 id="ultimos" className="text-sm font-medium text-grafito">
          Últimos movimientos
        </h3>
        <Libreta
          events={events}
          mandateIds={affected}
          limit={10}
          className="-mx-3"
        />
      </section>
    </div>
  );
};
