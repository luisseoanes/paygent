import { CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { AuthLayout } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { paths } from '@/config/paths';
import { Vincular } from '@/features/billetera/components/vincular';
import { useDispositivoStore } from '@/features/billetera/stores/dispositivo-store';
import { useUser } from '@/lib/auth';

// Enlazar (pública): la persona escribe o escanea el código que le dio un
// titular; este celular queda enlazado a esa rama y pasa a registrarse.
// Llega también desde el QR del titular: /enlazar?codigo=<id>.

const EnlazarRoute = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codigo =
    searchParams.get('codigo') ?? searchParams.get('vincular') ?? undefined;
  const user = useUser();
  const cargado = useDispositivoStore((s) => s.cargado);
  const dispositivo = useDispositivoStore((s) => s.dispositivo);
  const cargar = useDispositivoStore((s) => s.cargar);
  const olvidar = useDispositivoStore((s) => s.olvidar);
  // El enlace que había al abrir, para no saltar al registro sin preguntar.
  const previo = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  React.useEffect(() => {
    if (!cargado) return;
    if (previo.current === undefined) {
      previo.current = dispositivo?.mandateId ?? null;
      return;
    }
    // Se acaba de enlazar: sigue al registro.
    if (dispositivo && dispositivo.mandateId !== previo.current)
      navigate(paths.enlazar.registro.getHref());
  }, [cargado, dispositivo, navigate]);

  if (user.data?.role === 'beneficiario')
    return <Navigate to={paths.billetera.getHref()} replace />;

  const yaEnlazado =
    cargado && dispositivo && dispositivo.mandateId === previo.current;

  return (
    <>
      <Head
        title="Enlazar"
        description="Enlaza tu celular con el código que te dio el titular."
      />
      <AuthLayout
        title="Enlaza tu cuenta"
        description="Escribe o escanea el código que te dio quien te delega los pagos. Necesitas señal solo esta vez."
        footer={
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to={paths.auth.login.getHref()}>Inicia sesión</Link>
          </p>
        }
      >
        {!cargado ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : yaEnlazado ? (
          <div className="space-y-4">
            <p className="flex items-start gap-3 rounded-2xl bg-liquidado-tint p-4 text-sm text-liquidado">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Este celular ya está enlazado al código{' '}
                <span className="num font-medium">{dispositivo.mandateId}</span>
                .
              </span>
            </p>
            <Button asChild size="lg" className="w-full">
              <Link variant="unstyled" to={paths.enlazar.registro.getHref()}>
                Continuar con el registro
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                previo.current = null;
                await olvidar();
              }}
            >
              Enlazar con otro código
            </Button>
          </div>
        ) : (
          <Vincular codigoInicial={codigo} encabezado={false} />
        )}
      </AuthLayout>
    </>
  );
};

export default EnlazarRoute;
