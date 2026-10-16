import { Menu, X } from 'lucide-react';
import * as React from 'react';
import { useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { landingSections, paths } from '@/config/paths';
import { siteConfig } from '@/config/site';
import { useActiveSection } from '@/hooks/use-active-section';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useScrollToHash } from '@/hooks/use-scroll-to-hash';
import { cn } from '@/utils/cn';

import { Container } from './container';

const navLinkClassName = (isActive: boolean) =>
  cn(
    'inline-flex min-h-12 items-center rounded-md px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-sunken hover:text-ink md:min-h-10',
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

// Wordmark: sello circular + "Paygent" en Fraunces.
export const Wordmark = () => (
  <span className="inline-flex items-center gap-2">
    <svg
      viewBox="0 0 32 32"
      className="size-7 -rotate-6 text-firma"
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle
        cx="16"
        cy="16"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
      />
      <path
        d="M11 16.5l3.4 3.4L21.5 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="font-heading text-xl font-semibold tracking-[-0.01em] [font-variation-settings:'opsz'_72]">
      {siteConfig.name}
    </span>
  </span>
);

type SiteHeaderProps = {
  // Slot for extra controls on the right (e.g. a user menu composed in app/routes/root.tsx).
  actions?: React.ReactNode;
};

export const SiteHeader = ({ actions }: SiteHeaderProps) => {
  const mobileMenu = useDisclosure();
  const location = useLocation();
  // En la portada el header flota sobre el paisaje del hero (estilo Cofounder).
  const sobreHero = location.pathname === paths.home.getHref();
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
        sobreHero
          ? 'absolute inset-x-0'
          : 'sticky bg-paper/85 backdrop-blur-md',
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          to={paths.home.getHref()}
          variant="unstyled"
          aria-label={`${siteConfig.name}, ir a la portada`}
        >
          <Wordmark />
        </Link>

        <nav
          aria-label="Principal"
          className={cn(
            'hidden rounded-xl border p-1 lg:block',
            sobreHero
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
          </Container>
        </nav>
      )}
    </header>
  );
};
