import * as React from 'react';

import { Button } from '../button';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

export type ConfirmationDialogProps = {
  // Element that opens the dialog (usually a <Button />).
  triggerButton: React.ReactElement;
  title: string;
  body?: string;
  // Contenido extra (p. ej. vista previa de lo que se va a afectar).
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  // Close the dialog when the action finishes (e.g. mutation.isSuccess).
  isDone?: boolean;
  onConfirm: () => void;
};

export const ConfirmationDialog = ({
  triggerButton,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  isLoading = false,
  isDone = false,
  onConfirm,
  children,
}: ConfirmationDialogProps) => {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (isDone) setOpen(false);
  }, [isDone]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {body && <DialogDescription>{body}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button variant={variant} isLoading={isLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
