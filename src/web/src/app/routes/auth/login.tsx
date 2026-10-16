import { Navigate, useNavigate, useSearchParams } from 'react-router';

import paisaje from '@/assets/paisaje-cielo.png';
import { MarcaDeAutenticidad } from '@/components/brand/marca-autenticidad';
import { Head } from '@/components/seo';
import { Spinner } from '@/components/ui/spinner';
import { Heading } from '@/components/ui/typography';
import { homeHref } from '@/config/demo-users';
import { LoginForm } from '@/features/auth/components/login-form';
import { useUser } from '@/lib/auth';
import { type User } from '@/types/api';

// Iniciar sesión: el paisaje del hero a la izquierda y el formulario en papel
// a la derecha. Al entrar, vuelve a donde iba (redirectTo) o al panel de Juan.

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
        description="Entra para ver tu mandato, tus delegados y lo último que pasó."
      />
      <div className="mx-auto grid w-full max-w-[90rem] flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <section
          aria-hidden="true"
          className="relative isolate hidden overflow-hidden bg-firma lg:block"
        >
          <img
            src={paisaje}
            alt=""
            width={320}
            height={180}
            className="absolute inset-0 -z-10 h-full w-full animate-paneo object-cover object-[60%_100%] pixelado motion-reduce:animate-none"
          />
          <div className="flex h-full flex-col justify-end p-10">
            <p className="max-w-[22ch] font-geist text-[clamp(1.75rem,2.6vw,2.4rem)] leading-[1.1] font-light tracking-[-0.03em] text-paper-raised drop-shadow-[0_1px_8px_rgb(20_60_120/0.25)]">
              Firmado una vez en Texas.{' '}
              <span className="font-pixel tracking-normal">
                Pagado donde no hay señal.
              </span>
            </p>
          </div>
        </section>

        <div className="flex items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <Heading level="h1" className="text-3xl">
                Iniciar sesión
              </Heading>
              <p className="text-sm text-grafito-2">
                Juan ve su mandato, María paga con su celular y el tendero
                cobra.
              </p>
            </div>

            <div className="rounded-xl border border-rule bg-paper-raised p-6 shadow-[0_1px_2px_rgb(28_34_48/0.04),0_12px_32px_-18px_rgb(28_34_48/0.25)]">
              <LoginForm
                onSuccess={(u) => navigate(destinoDe(u), { replace: true })}
              />
            </div>

            <p className="flex flex-wrap items-center gap-2 text-xs text-grafito-2">
              <MarcaDeAutenticidad kind="simulado" label="Sesión simulada" />
              Juan, María y el tendero tienen su cuenta. El mandato, el celular
              y los cobros sí son reales.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRoute;
