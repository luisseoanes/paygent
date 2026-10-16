import { LogOut } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useNavigate } from 'react-router';

import paisaje from '@/assets/paisaje-cielo.png';
import { EstadoConexion } from '@/components/brand/estado-conexion';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { paths } from '@/config/paths';
import { useOnline } from '@/hooks/use-online';
import { useLogout, useUser } from '@/lib/auth';

import { Wordmark } from './site-header';

// Marco de las apps de rol (María, tendero). En el celular es solo la tarea,
// a lo ancho. En el computador, el paisaje de la portada a la izquierda con
// qué hace esta app, y la app en papel a la derecha (como el login).

export type AppShellProps = {
  rol: string;
  // Frase del panel de la izquierda (escritorio); la parte en pixel va aparte
  titular: string;
  titularPixel: string;
  pasos: string[];
  // Escritorio: reemplaza el texto del paisaje (p. ej. el chat en una nube)
  escena?: React.ReactNode;
  children: React.ReactNode;
};

const PanelMarca = ({
  rol,
  titular,
  titularPixel,
  pasos,
  escena,
}: Omit<AppShellProps, 'children'>) => {
  const reduceMotion = useReducedMotion();
  return (
    <aside
      aria-label={`Qué hace la app de ${rol}`}
      className="relative isolate hidden overflow-hidden bg-firma lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-10"
    >
      <img
        src={paisaje}
        alt=""
        width={320}
        height={180}
        className="absolute inset-0 -z-10 h-full w-full animate-paneo object-cover object-[60%_100%] pixelado motion-reduce:animate-none"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-grafito/35 via-transparent to-grafito/40" />

      <Link
        to={paths.home.getHref()}
        variant="unstyled"
        aria-label="Paygent, ir a la portada"
        className="self-start rounded-xl bg-paper-raised/85 px-3 py-2 backdrop-blur-md"
      >
        <Wordmark />
      </Link>

      <AnimatePresence mode="wait" initial={false}>
        {escena ? (
          <div
            key="escena"
            className="flex flex-1 items-center justify-center py-8"
          >
            {escena}
          </div>
        ) : (
          <motion.div
            key="texto"
            className="space-y-8"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: -24, filter: 'blur(6px)' }
            }
            transition={{ duration: 0.35, ease: [0.3, 0.7, 0.2, 1] }}
          >
            <p className="max-w-[20ch] font-geist text-[clamp(2rem,3vw,2.75rem)] leading-[1.08] font-light tracking-[-0.03em] text-paper-raised drop-shadow-[0_1px_8px_rgb(20_60_120/0.3)]">
              {titular}{' '}
              <span className="font-pixel tracking-normal">{titularPixel}</span>
            </p>
            <ol className="max-w-md space-y-3 rounded-3xl border border-vidrio-borde bg-paper-raised/85 p-5 backdrop-blur-md">
              {pasos.map((paso, i) => (
                <li
                  key={paso}
                  className="flex gap-3 text-[0.9375rem] text-grafito"
                >
                  <span
                    aria-hidden="true"
                    className="cifra inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-firma-tint text-sm text-firma"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{paso}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};

export const AppShell = ({ children, ...panel }: AppShellProps) => {
  const online = useOnline();
  const navigate = useNavigate();
  const user = useUser().data;
  const logout = useLogout({
    onSuccess: () => navigate(paths.auth.login.getHref()),
  });

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
      <PanelMarca {...panel} />

      <div className="flex min-h-dvh flex-col lg:bg-paper-sunken/40">
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-2 px-4 lg:h-20">
            <Link
              to={paths.home.getHref()}
              variant="unstyled"
              aria-label="Paygent, ir a la portada"
              className="flex min-w-0 items-center gap-2 lg:hidden"
            >
              <Wordmark />
            </Link>
            <p className="hidden min-w-0 truncate text-sm text-ink-2 lg:block">
              {user ? `${user.name} · ${panel.rol}` : panel.rol}
            </p>
            <div className="flex items-center gap-1">
              <EstadoConexion online={online} />
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar sesión"
                  isLoading={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <LogOut aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-2 pb-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
