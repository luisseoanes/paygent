import { ChevronDown, LayoutGrid, LogOut } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router';

import { Link } from '@/components/ui/link';
import { homeHref, nombreCompleto, rolLabel } from '@/config/demo-users';
import { paths } from '@/config/paths';
import { pedirCierreDeSesion, useUser } from '@/lib/auth';
import { cn } from '@/utils/cn';

// Menú de la cuenta (arriba a la derecha, en todas las pantallas con sesión):
// las iniciales abren quién eres, el acceso a tu app y "Cerrar sesión".

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const MenuCuenta = ({ className }: { className?: string }) => {
  const user = useUser().data;
  const navigate = useNavigate();
  const [abierto, setAbierto] = React.useState(false);
  const raiz = React.useRef<HTMLDivElement>(null);
  const boton = React.useRef<HTMLButtonElement>(null);
  const id = React.useId();
  // Sale a la portada y la sesión se cierra al llegar (ver lib/auth).
  const cerrarSesion = () => {
    setAbierto(false);
    pedirCierreDeSesion();
    navigate(paths.home.getHref());
  };

  // Se cierra al tocar fuera o con Escape (el foco vuelve al botón).
  React.useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!user) return null;
  const nombre = nombreCompleto(user);

  return (
    <div ref={raiz} className={cn('relative', className)}>
      <button
        ref={boton}
        type="button"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={`Cuenta de ${nombre}`}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-12 items-center gap-1.5 rounded-full border border-rule bg-paper-raised py-1 pr-2.5 pl-1 transition-colors hover:bg-paper-sunken focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-10"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-9 items-center justify-center rounded-full bg-firma-tint text-sm font-medium text-firma md:size-8"
        >
          {iniciales(nombre)}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-ink-2 transition-transform',
            abierto && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {abierto && (
        <div
          id={id}
          className="absolute top-full right-0 z-50 mt-2 w-72 animate-in rounded-2xl border border-rule bg-paper-raised p-2 shadow-[0_1px_2px_rgb(28_34_48/0.06),0_16px_40px_-16px_rgb(28_34_48/0.35)] fade-in-0 slide-in-from-top-1"
        >
          <div className="px-3 pt-2 pb-3">
            <p className="truncate text-[0.9375rem] font-medium text-grafito">
              {nombre}
            </p>
            <p className="truncate text-sm text-ink-2">{user.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-paper-sunken px-2 py-0.5 text-xs text-ink-2">
              Cuenta de {rolLabel[user.role].nombre}
            </p>
          </div>
          <div className="border-t border-rule pt-1">
            <Link
              variant="unstyled"
              to={homeHref(user.role)}
              onClick={() => setAbierto(false)}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-grafito transition-colors hover:bg-paper-sunken"
            >
              <LayoutGrid className="size-4 text-ink-2" aria-hidden="true" />
              {rolLabel[user.role].app}
            </Link>
            <button
              type="button"
              onClick={cerrarSesion}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-anulado transition-colors hover:bg-anulado-tint disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
