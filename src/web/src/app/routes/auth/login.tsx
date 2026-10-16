import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { AuthLayout } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { homeHref } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { LoginForm } from '@/features/auth/components/login-form';
import { useUser } from '@/lib/auth';
import { type User } from '@/types/api';

// Iniciar sesión. Al entrar, vuelve a donde iba (redirectTo) o a la app de
// su tipo de cuenta. Desde aquí se crea una cuenta con wallet o se enlaza un
// celular con el código de un titular.

// Solo rutas internas: evita redirecciones abiertas.
export const destinoSeguro = (redirectTo: string | null, user: User) =>
  redirectTo?.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : homeHref(user.role);

const LoginRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useUser();
  const redirectTo = searchParams.get('redirectTo');

  if (user.isPending)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  if (user.data)
    return <Navigate to={destinoSeguro(redirectTo, user.data)} replace />;

  return (
    <>
      <Head
        title="Iniciar sesión"
        description="Entra a tu cuenta de Paygent."
      />
      <AuthLayout
        title="Iniciar sesión"
        footer={
          <>
            <p>
              ¿No tienes cuenta?{' '}
              <Link to={paths.auth.registro.getHref()}>Regístrate</Link>
            </p>
            <p>
              ¿Te dieron un código?{' '}
              <Link to={paths.enlazar.getHref()}>Enlaza tu cuenta</Link>
            </p>
          </>
        }
      >
        <LoginForm
          onSuccess={(u) =>
            navigate(destinoSeguro(redirectTo, u), { replace: true })
          }
        />
      </AuthLayout>
    </>
  );
};

export default LoginRoute;
