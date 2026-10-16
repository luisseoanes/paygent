import { type QueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { SectionErrorFallback } from '@/components/errors';
import { Head } from '@/components/seo';
import { Skeleton } from '@/components/ui/skeleton';
import { nombreCompleto } from '@/config/demo-users';
import {
  getGrantStatusQueryOptions,
  useGrantStatus,
} from '@/features/mandates/api/get-grant-status';
import { useMandateTree } from '@/features/mandates/api/get-mandate-tree';
import { FirmarMandato } from '@/features/mandates/components/firmar-mandato';
import { MandatoPanel } from '@/features/mandates/components/mandato-panel';
import { useGrantCallback } from '@/features/mandates/hooks/use-grant-callback';
import { ProtectedRoute, useUser } from '@/lib/auth';
import { type User } from '@/types/api';

// Cuenta del titular (la persona con wallet): si aún no firmó (o revocó) su
// mandato, lo firma en su billetera; si ya lo tiene, ve a quién le delegó y
// lo último que pasó. Solo con sesión de titular.

// Precarga el estado del grant mientras se resuelve la sesión.
export const clientLoader = (queryClient: QueryClient) => async () => {
  queryClient.prefetchQuery(getGrantStatusQueryOptions());
  return null;
};

const MandatoDelTitular = ({
  user,
}: {
  user: User & { rootMandateId: string };
}) => {
  const status = useGrantStatus();
  // Solo para saber si el anterior fue revocado (cambia el texto del formulario).
  const tree = useMandateTree({
    mandateId: user.rootMandateId,
    queryConfig: { enabled: status.data?.rootGrant === false },
  });

  if (status.isPending)
    return <Skeleton className="mx-auto h-80 max-w-4xl rounded-xl" />;

  // Sin estado del grant seguimos con el panel: él muestra su propio error.
  if (status.data?.rootGrant === false)
    return (
      <FirmarMandato
        walletAddress={user.walletAddress}
        simulado={status.data.mockOp}
        revocado={tree.data?.revoked}
      />
    );

  return (
    <MandatoPanel
      mandateId={user.rootMandateId}
      grantSimulado={status.data?.mockOp}
    />
  );
};

const CuentaContent = () => {
  useGrantCallback();
  const user = useUser().data;
  if (!user) return null;

  return (
    <>
      <Head
        title={nombreCompleto(user)}
        description="Delega pagos a tu familia y a tus agentes."
      />
      <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-2 sm:px-8 sm:pt-8">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-normal tracking-[-0.02em] text-grafito">
              Hola, {user.name}
            </h1>
            <p className="text-sm text-ink-2">
              Lo que le diste a tu familia y a tus agentes, y en qué se fue.
            </p>
          </div>
          {user.walletAddress && (
            <p className="flex min-w-0 items-center gap-2 rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs text-ink-2">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-liquidado"
              />
              <span className="num truncate">{user.walletAddress}</span>
            </p>
          )}
        </header>

        <div className="flex-1 px-4 py-6 sm:px-8 sm:pb-12">
          <ErrorBoundary FallbackComponent={SectionErrorFallback}>
            {user.rootMandateId ? (
              <MandatoDelTitular
                user={{ ...user, rootMandateId: user.rootMandateId }}
              />
            ) : (
              <FirmarMandato walletAddress={user.walletAddress} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
};

const CuentaRoute = () => (
  <ProtectedRoute rol="titular">
    <CuentaContent />
  </ProtectedRoute>
);

export default CuentaRoute;
