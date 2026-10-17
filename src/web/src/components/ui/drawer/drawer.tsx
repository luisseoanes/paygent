import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/utils/cn';

// Drawer accesible (Radix Dialog): panel lateral de 480px en escritorio y
// hoja inferior al 92% de alto en móvil (BRAND.md §3.9).

export const Drawer = DialogPrimitive.Root;

export type DrawerContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  title: string;
  description?: string;
  // Placa en mono sobre el título (p. ej. "RAMA · AGENTE")
  eyebrow?: React.ReactNode;
};

export const DrawerContent = ({
  className,
  children,
  title,
  description,
  eyebrow,
  ...props
}: DrawerContentProps) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden border-rule-strong bg-paper-raised shadow-lg duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in',
        // Móvil: hoja inferior
        'inset-x-0 bottom-0 h-[92dvh] rounded-t-md border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        // Tablet/escritorio: panel lateral
        'md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:w-[420px] md:rounded-none md:border-t-0 md:border-l md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right lg:w-[480px]',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 border-b border-rule px-5 pt-5 pb-4">
        <div className="min-w-0 space-y-1">
          {eyebrow && <div className="folio text-ink-2">{eyebrow}</div>}
          <DialogPrimitive.Title className="font-heading text-2xl leading-tight font-semibold [font-variation-settings:'opsz'_72]">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-sm text-ink-2">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close className="-mr-2 inline-flex size-12 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-paper-sunken hover:text-ink">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);
