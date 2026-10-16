import { Outlet, useLocation } from 'react-router';

import { MainLayout, MenuCuenta } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { homeHref, rolLabel } from '@/config/demo-users';
import { pantallasDeEntrada, paths } from '@/config/paths';
import { useCierrePendiente, useUser } from '@/lib/auth';
import { cn } from '@/utils/cn';

const HeaderActions = () => {
  const { pathname } = useLocation();
  const user = useUser();

  if (user.data)
    return (
      <>
        <Button size="sm" asChild className="hidden sm:inline-flex">
          <Link variant="unstyled" to={homeHref(user.data.role)}>
            {rolLabel[user.data.role].app}
          </Link>
        </Button>
        <MenuCuenta />
      </>
    );

  // En las pantallas de entrada el botón sobra.
  if (pantallasDeEntrada.includes(pathname)) return null;

  // Sobre el cielo del hero, los secundarios van en vidrio para leerse.
  const vidrio =
    pathname === paths.home.getHref()
      ? 'border-vidrio-borde bg-vidrio text-grafito backdrop-blur-md hover:bg-paper-raised'
      : 'bg-paper-raised';

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        asChild
        className={cn('hidden lg:inline-flex', vidrio)}
      >
        <Link variant="unstyled" to={paths.enlazar.getHref()}>
          Enlazar cuenta
        </Link>
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        className={cn('hidden sm:inline-flex', vidrio)}
      >
        <Link variant="unstyled" to={paths.auth.registro.getHref()}>
          Registrarse
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link variant="unstyled" to={paths.auth.login.getHref()}>
          Iniciar sesión
        </Link>
      </Button>
    </>
  );
};

// En el celular no caben en la barra: van al final del menú.
const MenuActions = () => {
  const user = useUser();
  if (user.data || user.isPending) return null;
  return (
    <>
      <Button asChild variant="outline" className="w-full bg-paper-raised">
        <Link variant="unstyled" to={paths.auth.registro.getHref()}>
          Registrarse
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full bg-paper-raised">
        <Link variant="unstyled" to={paths.enlazar.getHref()}>
          Enlazar cuenta
        </Link>
      </Button>
    </>
  );
};

const AppRoot = () => {
  useCierrePendiente();
  return (
    <MainLayout
      headerActions={<HeaderActions />}
      headerMenuActions={<MenuActions />}
    >
      <Outlet />
    </MainLayout>
  );
};

export default AppRoot;
