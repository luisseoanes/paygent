import { CloudOff, RotateCcw } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotifications } from '@/components/ui/notifications';
import { Skeleton } from '@/components/ui/skeleton';
import { type MandateTree } from '@/types/api';
import { cn } from '@/utils/cn';

import { useMandateTree } from '../api/get-mandate-tree';
import { useRevokeMandate } from '../api/revoke-mandate';
import { type FeedStatus, useFeedStream } from '../api/use-feed-stream';
import { findNode, holderTypeLabel, ramasDelegables } from '../utils/mandate';

import { Delegados, TarjetaGuardian } from './delegados';
import { DelegarRama } from './delegar-rama';
import { Libreta, esAlerta } from './libreta';
import { RamaDetalle } from './rama-detalle';
import { ResumenMandato } from './resumen-mandato';

// Panel de Juan, ordenado por lo que necesita hacer: 1) ver cuánto queda y
// quién gastó, 2) delegar o ajustar una rama, 3) frenar algo. Datos:
// GET /mandates/:id/tree y GET /feed/stream (SSE).

const Seccion = ({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-3 flex min-h-8 items-center justify-between gap-3 px-2">
        <h2 id={id} className="text-base font-medium text-grafito">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
};

const feedStatusLabel: Record<FeedStatus, string> = {
  connecting: 'Conectando…',
  open: 'En vivo',
  closed: 'Sin conexión',
  unsupported: 'Sin feed en vivo',
};

const PanelSkeleton = () => (
  <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
    <div className="space-y-6">
      <Skeleton className="h-80 rounded-3xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
    <Skeleton className="h-96 rounded-3xl" />
  </div>
);

// Al fondo y en voz baja: revocar todo es la última salida, no la primera.
const RevocarTodo = ({ root }: { root: MandateTree }) => {
  const addNotification = useNotifications((s) => s.addNotification);
  const revoke = useRevokeMandate({
    mutationConfig: {
      onSuccess: () =>
        addNotification({
          type: 'success',
          title: 'Mandato revocado',
          message: 'Ninguna rama puede gastar hasta que firmes uno nuevo.',
        }),
    },
  });
  if (root.revoked) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-ink-2">
      <span>Firmaste este mandato en tu billetera.</span>
      <ConfirmationDialog
        title="¿Revocar todo el mandato?"
        body="Se cancela el permiso en tu billetera. Ninguna rama podrá gastar hasta que firmes uno nuevo."
        confirmLabel="Revocar todo"
        isLoading={revoke.isPending}
        isDone={revoke.isSuccess}
        onConfirm={() => revoke.mutate({ mandateId: root.id })}
        triggerButton={
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-full px-3 text-anulado transition-colors hover:bg-anulado-tint"
          >
            Revocar todo el mandato
          </button>
        }
      />
    </div>
  );
};

export const MandatoPanel = ({
  mandateId,
  grantSimulado = false,
  className,
}: {
  mandateId: string;
  // El gateway corre sin Test Wallet (MOCK_OP)
  grantSimulado?: boolean;
  className?: string;
}) => {
  const tree = useMandateTree({ mandateId });
  const feed = useFeedStream();
  const [nodeId, setNodeId] = React.useState<string>();
  const [libreta, setLibreta] = React.useState(false);
  // undefined: cerrado · '': desde la primera rama disponible · id: desde esa rama
  const [delegarDesde, setDelegarDesde] = React.useState<string>();

  if (tree.isPending) return <PanelSkeleton />;

  if (tree.isError || !tree.data)
    return (
      <EmptyState
        icon={<CloudOff />}
        title="No pudimos traer tu mandato"
        description="El gateway no respondió. Nada cambió en tu billetera."
        action={
          <Button
            variant="outline"
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => tree.refetch()}
          >
            Reintentar
          </Button>
        }
        className={cn('rounded-3xl', className)}
      />
    );

  const root = tree.data;
  const node = nodeId ? findNode(root, nodeId) : undefined;
  const parent = node?.parentId ? findNode(root, node.parentId) : undefined;
  const alertas = feed.events.slice(0, 8).filter(esAlerta).length;
  const abrirDelegar =
    ramasDelegables(root).length > 0
      ? (desde = '') => {
          setNodeId(undefined);
          setDelegarDesde(desde);
        }
      : undefined;

  return (
    <div
      className={cn(
        'grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]',
        className,
      )}
    >
      <div className="min-w-0 space-y-8">
        <ResumenMandato
          root={root}
          simulado={grantSimulado}
          onDelegar={abrirDelegar && (() => abrirDelegar())}
          onLibreta={() => setLibreta(true)}
        />

        <Seccion
          title="Delegados"
          action={
            <span className="text-xs text-ink-2">
              Toca a alguien para ajustarlo
            </span>
          }
        >
          <Delegados
            root={root}
            onOpen={setNodeId}
            onDelegar={abrirDelegar && (() => abrirDelegar())}
          />
        </Seccion>

        <Seccion title="Te cuida" className="hidden lg:block">
          <TarjetaGuardian root={root} onOpen={setNodeId} />
        </Seccion>
      </div>

      <div className="min-w-0 space-y-8 lg:sticky lg:top-24">
        <Seccion
          title="Actividad"
          action={
            <span className="flex items-center gap-3 text-xs text-ink-2">
              {alertas > 0 && (
                <span className="rounded-full bg-anulado-tint px-2 py-0.5 font-medium text-anulado">
                  {alertas} {alertas === 1 ? 'alerta' : 'alertas'}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    feed.status === 'open'
                      ? 'animate-pulse bg-liquidado motion-reduce:animate-none'
                      : 'bg-ink-3',
                  )}
                />
                {feedStatusLabel[feed.status]}
              </span>
            </span>
          }
        >
          <div className="rounded-3xl bg-paper-raised p-2 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-22px_rgb(28_34_48/0.3)]">
            <Libreta events={feed.events} limit={6} />
            {feed.events.length > 6 && (
              <button
                type="button"
                onClick={() => setLibreta(true)}
                className="mt-1 flex min-h-12 w-full items-center justify-center rounded-2xl text-sm text-firma transition-colors hover:bg-firma-tint/60"
              >
                Ver toda la libreta
              </button>
            )}
          </div>
        </Seccion>

        <Seccion title="Te cuida" className="lg:hidden">
          <TarjetaGuardian root={root} onOpen={setNodeId} />
        </Seccion>

        <RevocarTodo root={root} />
      </div>

      <Drawer
        open={!!node}
        onOpenChange={(open) => !open && setNodeId(undefined)}
      >
        {node && (
          <DrawerContent
            title={node.holderName}
            description={`${holderTypeLabel[node.holderType]} · ${
              parent && parent.id !== root.id
                ? `sale de ${parent.holderName}`
                : 'sale de tu mandato'
            }`}
          >
            <RamaDetalle
              node={node}
              root={root}
              parent={parent}
              events={feed.events}
              onDelegate={abrirDelegar && (() => abrirDelegar(node.id))}
            />
          </DrawerContent>
        )}
      </Drawer>

      <Drawer
        open={delegarDesde !== undefined}
        onOpenChange={(open) => !open && setDelegarDesde(undefined)}
      >
        {delegarDesde !== undefined && (
          <DrawerContent
            title="Delegar"
            description="Reparte parte de tu tope. Puedes revocarla cuando quieras."
          >
            <DelegarRama
              root={root}
              parentId={delegarDesde || undefined}
              onDone={() => setDelegarDesde(undefined)}
            />
          </DrawerContent>
        )}
      </Drawer>

      <Drawer open={libreta} onOpenChange={setLibreta}>
        <DrawerContent
          title="Libreta"
          description="Cada movimiento, con su porqué."
        >
          <Libreta events={feed.events} className="-mx-3" />
        </DrawerContent>
      </Drawer>
    </div>
  );
};
