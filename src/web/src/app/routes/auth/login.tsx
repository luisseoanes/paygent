import { Navigate, useNavigate, useSearchParams } from 'react-router';

import paisaje from '@/assets/paisaje-cielo.png';
import { NubePixel } from '@/components/brand/nube-pixel';
import { Head } from '@/components/seo';
import { Spinner } from '@/components/ui/spinner';
import { Heading } from '@/components/ui/typography';
import { homeHref } from '@/config/demo-users';
import { LoginForm } from '@/features/auth/components/login-form';
import { useUser } from '@/lib/auth';
import { type User } from '@/types/api';

// Iniciar sesión: el paisaje pixel de la portada a pantalla completa y el
// formulario dentro de una nube pixel art. Al entrar, vuelve a donde iba
// (redirectTo) o a la app de su rol.

const LoginRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useUser();
  const redirectTo = searchParams.get('redirectTo');
  // Vuelve a donde iba (solo rutas internas: evita redirecciones abiertas) o
  // a la app de su rol.
  const destinoDe = (user: User) =>
    redirectTo?.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : homeHref(user.role);

  if (user.isPending)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  if (user.data) return <Navigate to={destinoDe(user.data)} replace />;

  return (
    <>
      <Head
        title="Iniciar sesión"
        description="Entra a Paygent como Juan, María o el tendero."
      />
      {/* El paisaje ocupa toda la pantalla, también detrás del menú. */}
      <div className="relative isolate flex min-h-dvh flex-1 overflow-hidden bg-firma">
        <img
          src={paisaje}
          alt=""
          width={320}
          height={180}
          className="absolute inset-0 -z-10 h-full w-full animate-paneo object-cover object-[60%_100%] pixelado motion-reduce:animate-none"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-grafito/30 via-transparent to-transparent" />

        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-6 px-4 pt-20 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:pt-28">
          <p className="hidden max-w-[22ch] self-end pb-6 font-geist text-[clamp(1.75rem,2.6vw,2.4rem)] leading-[1.1] font-light tracking-[-0.03em] text-paper-raised drop-shadow-[0_1px_8px_rgb(20_60_120/0.25)] lg:block">
            Firmado una vez en Texas.{' '}
            <span className="font-pixel tracking-normal">
              Pagado donde no hay señal.
            </span>
          </p>

          {/* Margen para que los bultos de la nube quepan alrededor */}
          <NubePixel className="mx-6 my-14 w-auto max-w-md sm:mx-auto sm:w-full lg:mr-14">
            <div className="space-y-6">
              <Heading level="h1" className="text-3xl">
                Iniciar sesión
              </Heading>
              <LoginForm
                onSuccess={(u) => navigate(destinoDe(u), { replace: true })}
              />
            </div>
          </NubePixel>
        </div>
      </div>
    </>
  );
};

export default LoginRoute;
