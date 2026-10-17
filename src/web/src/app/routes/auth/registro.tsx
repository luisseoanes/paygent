import type * as React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { AuthLayout } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { homeHref } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { RegistroTenderoForm } from '@/features/auth/components/registro-tendero-form';
import { RegistroTitularForm } from '@/features/auth/components/registro-titular-form';
import { useUser } from '@/lib/auth';
import { cn } from '@/utils/cn';

// Registrarse: el titular (con wallet de Open Payments, delega) o, con
// ?tipo=tienda, el tendero (cobra con o sin wallet). Al crear la cuenta entra
// directo a su app.

const Pestaña = ({
  activa,
  to,
  children,
}: {
  activa: boolean;
  to: string;
  children: React.ReactNode;
}) => (
  <Link
    variant="unstyled"
    to={to}
    replace
    aria-current={activa ? 'page' : undefined}
    className={cn(
      'flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-sm transition-colors',
      activa
        ? 'bg-paper-raised font-medium text-grafito shadow-[0_1px_2px_rgb(28_34_48/0.08)]'
        : 'text-ink-2 hover:text-grafito',
    )}
  >
    {children}
  </Link>
);

const RegistroRoute = () => {
  const navigate = useNavigate();
  const user = useUser();
  const tienda = useSearchParams()[0].get('tipo') === 'tienda';

  if (user.isPending)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  if (user.data) return <Navigate to={homeHref(user.data.role)} replace />;

  return (
    <>
      <Head
        title="Registrarse"
        description={
          tienda
            ? 'Registra tu tienda en Paygent y cobra con o sin señal.'
            : 'Crea tu cuenta de Paygent con tu wallet de Open Payments.'
        }
      />
      <AuthLayout
        centrado
        title={tienda ? 'Registra tu tienda' : 'Crea tu cuenta'}
        description={
          tienda
            ? 'Cobras con el QR de tus clientes, con o sin señal. Sin wallet: Puntored te acredita en tu llave Bre-B.'
            : 'Con tu wallet de Open Payments. Después repartes permisos a tu familia y a tus agentes.'
        }
        footer={
          <>
            <p>
              ¿Ya tienes cuenta?{' '}
              <Link to={paths.auth.login.getHref()}>Inicia sesión</Link>
            </p>
            <p>
              ¿Te dieron un código?{' '}
              <Link to={paths.enlazar.getHref()}>Enlaza tu cuenta</Link>
            </p>
          </>
        }
      >
        <nav
          aria-label="Tipo de cuenta"
          className="mb-6 flex gap-1 rounded-full bg-hueso-2 p-1"
        >
          <Pestaña activa={!tienda} to={paths.auth.registro.getHref()}>
            Delegar pagos
          </Pestaña>
          <Pestaña activa={tienda} to={paths.auth.registro.getHref('tienda')}>
            Cobrar en mi tienda
          </Pestaña>
        </nav>
        {tienda ? (
          <RegistroTenderoForm
            onSuccess={() =>
              navigate(paths.tendero.getHref(), { replace: true })
            }
          />
        ) : (
          <RegistroTitularForm
            onSuccess={() =>
              navigate(paths.cuenta.getHref(), { replace: true })
            }
          />
        )}
      </AuthLayout>
    </>
  );
};

export default RegistroRoute;
