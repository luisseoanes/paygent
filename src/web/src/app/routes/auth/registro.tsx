import { Navigate, useNavigate } from 'react-router';

import { AuthLayout } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { homeHref } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { RegistroTitularForm } from '@/features/auth/components/registro-titular-form';
import { useUser } from '@/lib/auth';

// Registrarse (titular): quien tiene wallet de Open Payments y delega. Al
// crear la cuenta entra directo a su cuenta.

const RegistroRoute = () => {
  const navigate = useNavigate();
  const user = useUser();

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
        description="Crea tu cuenta de Paygent con tu wallet de Open Payments."
      />
      <AuthLayout
        centrado
        title="Crea tu cuenta"
        description="Con tu wallet de Open Payments. Después repartes permisos a tu familia y a tus agentes."
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
        <RegistroTitularForm
          onSuccess={() => navigate(paths.cuenta.getHref(), { replace: true })}
        />
      </AuthLayout>
    </>
  );
};

export default RegistroRoute;
