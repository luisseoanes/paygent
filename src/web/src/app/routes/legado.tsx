import { Navigate, useLocation } from 'react-router';

import { paths } from '@/config/paths';

// Rutas viejas que siguen llegando desde afuera:
// - src/api redirige a /juan?ok=1 tras firmar el mandato → /cuenta?ok=1
// - QR impresos con /maria?vincular=<id> → /enlazar?codigo=<id>
const LegadoRoute = () => {
  const { pathname, search } = useLocation();
  if (pathname.startsWith(paths.legado.maria.path)) {
    const codigo = new URLSearchParams(search).get('vincular');
    return (
      <Navigate
        to={codigo ? paths.enlazar.getHref(codigo) : paths.billetera.getHref()}
        replace
      />
    );
  }
  return <Navigate to={`${paths.cuenta.getHref()}${search}`} replace />;
};

export default LegadoRoute;
