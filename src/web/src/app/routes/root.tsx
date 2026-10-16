import { LogOut } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { MainLayout } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { homeHref, rolLabel } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { useLogout, useUser } from '@/lib/auth';

const HeaderActions = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useUser();
  const logout = useLogout({
    onSuccess: () => navigate(paths.home.getHref()),
  });

  if (user.data)
    return (
      <>
        <Button size="sm" asChild className="hidden sm:inline-flex">
          <Link variant="unstyled" to={homeHref(user.data.role)}>
            {rolLabel[user.data.role].app}
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isLoading={logout.isPending}
          icon={<LogOut aria-hidden="true" />}
          onClick={() => logout.mutate()}
        >
          <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
        </Button>
      </>
    );

  // En la pantalla de iniciar sesión el botón sobra.
  if (pathname === paths.auth.login.path) return null;

  return (
    <Button size="sm" asChild>
      <Link variant="unstyled" to={paths.auth.login.getHref()}>
        Iniciar sesión
      </Link>
    </Button>
  );
};

const AppRoot = () => {
  return (
    <MainLayout headerActions={<HeaderActions />}>
      <Outlet />
    </MainLayout>
  );
};

export default AppRoot;
