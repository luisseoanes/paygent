import type * as React from 'react';

import { SiteHeader } from './site-header';

type MainLayoutProps = {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  // Al final del menú móvil
  headerMenuActions?: React.ReactNode;
};

export const MainLayout = ({
  children,
  headerActions,
  headerMenuActions,
}: MainLayoutProps) => {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <SiteHeader actions={headerActions} menuActions={headerMenuActions} />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
};
