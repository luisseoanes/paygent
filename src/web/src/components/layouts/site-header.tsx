import { Menu, X } from 'lucide-react';
import * as React from 'react';
import { useLocation } from 'react-router';

import { LogoPaygent } from '@/components/brand/logo-paygent';
import { NubePixel } from '@/components/brand/nube-pixel';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { landingSections, pantallasDeEntrada, paths } from '@/config/paths';
import { siteConfig } from '@/config/site';
import { useActiveSection } from '@/hooks/use-active-section';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useScrollToHash } from '@/hooks/use-scroll-to-hash';
import { cn } from '@/utils/cn';

import { Container } from './container';

const navLinkClassName = (isActive: boolean) =>
  cn(
    'inline-flex min-h-12 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-2 transition-colors hover:bg-paper-sunken hover:text-ink md:min-h-10 lg:px-2 xl:px-3',
    isActive && 'bg-paper-sunken text-ink',
  );

// Cada enlace lleva a una sección de la portada; en la portada se marca la
// que se está leyendo.
const NavItems = ({
  className,
  activeSection,
}: {
  className?: string;
  activeSection?: string;
}) => (
  <ul className={className}>
    {siteConfig.mainNav.map((item) => {
      const isActive = !!item.section && item.section === activeSection;
      return (
        <li key={item.href}>
          <Link
            to={item.href}
            variant="unstyled"
            aria-current={isActive ? 'location' : undefined}
            className={navLinkClassName(isActive)}
          >
            {item.label}
          </Link>
        </li>
      );
    })}
  </ul>
);

// Wordmark: la P con ramas + "Paygent".
export const Wordmark = () => (
  <span className="inline-flex items-center gap-2">
    <LogoPaygent className="size-8" />
    <span className="font-heading text-xl font-semibold tracking-[-0.01em] [font-variation-settings:'opsz'_72]">
      {siteConfig.name}
    </span>
  </span>
);

type SiteHeaderProps = {
  // Slot for extra controls on the right (e.g. a user menu composed in app/routes/root.tsx).
  actions?: React.ReactNode;
  // Slot al final del menú móvil (lo que no cabe en la barra del celular)
  menuActions?: React.ReactNode;
};

export const SiteHeader = ({ actions, menuActions }: SiteHeaderProps) => {
  const mobileMenu = useDisclosure();
  const location = useLocation();
  // En la portada el header flota sobre el paisaje del hero (estilo Cofounder).
  const sobreHero = location.pathname === paths.home.getHref();
  // Pantallas de entrada (iniciar sesión, registrarse, enlazar): el menú
  // flota sobre el paisaje y el logo va en su nube.
  const enLogin = pantallasDeEntrada.includes(location.pathname);
  // El menú flota sobre el paisaje en la portada y en iniciar sesión.
  const sobreImagen = sobreHero || enLogin;
  const closeMobileMenu = mobileMenu.close;
  const activeSection = useActiveSection(landingSections, sobreHero);
  useScrollToHash();

  // Close the mobile menu after navigating (también al saltar de sección).
  React.useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, location.hash, location.key, closeMobileMenu]);

  return (
    <header
      className={cn(
        'top-0 z-40',
        sobreImagen
          ? 'absolute inset-x-0'
          : 'sticky bg-paper/85 backdrop-blur-md',
      )}
    >
      <Container
        className={cn(
          'flex h-16 items-center justify-between gap-4',
          // En iniciar sesión el logo va casi al borde, en su nube
          // Sobre el paisaje el logo va casi al borde izquierdo
          sobreImagen && 'max-w-none! px-3 sm:px-4 lg:px-5',
          enLogin && 'h-20',
        )}
      >
        <Link
          to={paths.home.getHref()}
          variant="unstyled"
          aria-label={`${siteConfig.name}, ir a la portada`}
        >
          {enLogin ? (
            <NubePixel tamano="sm" className="mt-6">
              <Wordmark />
            </NubePixel>
          ) : (
            <Wordmark />
          )}
        </Link>

        <nav
          aria-label="Principal"
          className={cn(
            'hidden rounded-xl border p-1 lg:block',
            sobreImagen
              ? 'border-vidrio-borde bg-vidrio backdrop-blur-md'
              : 'border-rule bg-paper-raised',
          )}
        >
          <NavItems
            className="flex items-center gap-1"
            activeSection={activeSection}
          />
        </nav>

        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={mobileMenu.isOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenu.isOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={mobileMenu.toggle}
          >
            {mobileMenu.isOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </Button>
        </div>
      </Container>

      {mobileMenu.isOpen && (
        <nav
          id="mobile-menu"
          aria-label="Menú móvil"
          className="animate-in border-t border-rule bg-paper fade-in-0 slide-in-from-top-2 lg:hidden"
        >
          <Container className="py-3">
            <NavItems
              className="flex flex-col gap-1"
              activeSection={activeSection}
            />
            {menuActions && (
              <div className="mt-3 flex flex-col gap-2 border-t border-rule pt-3">
                {menuActions}
              </div>
            )}
          </Container>
        </nav>
      )}
    </header>
  );
};
