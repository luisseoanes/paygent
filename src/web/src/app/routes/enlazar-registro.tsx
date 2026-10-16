import { CheckCircle2 } from 'lucide-react';
import * as React from 'react';
import { Navigate, useNavigate } from 'react-router';

import { AuthLayout } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Link } from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { homeHref } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { RegistroBeneficiarioForm } from '@/features/auth/components/registro-beneficiario-form';
import { useDispositivoStore } from '@/features/billetera/stores/dispositivo-store';
import { useUser } from '@/lib/auth';

// Registro del beneficiario: solo aparece después de enlazar el celular.
// No pide wallet: paga con lo que le delegaron. Al terminar entra a su
// billetera.

const EnlazarRegistroRoute = () => {
  const navigate = useNavigate();
  const user = useUser();
  const cargado = useDispositivoStore((s) => s.cargado);
  const dispositivo = useDispositivoStore((s) => s.dispositivo);
  const cargar = useDispositivoStore((s) => s.cargar);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  if (user.isPending || !cargado)
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  if (user.data) return <Navigate to={homeHref(user.data.role)} replace />;
  // Sin enlace no hay registro de beneficiario.
  if (!dispositivo) return <Navigate to={paths.enlazar.getHref()} replace />;

  return (
    <>
      <Head
        title="Registrarse"
        description="Termina tu registro para entrar a tu billetera."
      />
      <AuthLayout
        centrado
        title="Te falta registrarte"
        description={
          <span className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-liquidado"
              aria-hidden="true"
            />
            <span>
              Tu celular quedó enlazado al código{' '}
              <span className="num">{dispositivo.mandateId}</span>. Crea tu
              cuenta para entrar a tu billetera.
            </span>
          </span>
        }
        footer={
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to={paths.auth.login.getHref()}>Inicia sesión</Link>
          </p>
        }
      >
        <RegistroBeneficiarioForm
          mandateId={dispositivo.mandateId}
          onSuccess={() =>
            navigate(paths.billetera.getHref(), { replace: true })
          }
        />
      </AuthLayout>
    </>
  );
};

export default EnlazarRegistroRoute;
