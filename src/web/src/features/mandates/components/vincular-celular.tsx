import { QRCodeSVG } from 'qrcode.react';
import type * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { paths } from '@/config/paths';

// Juan le pasa a María el código de su rama de celular: un QR que abre
// /maria?vincular=<id> (la cámara del celular basta) o el código escrito.
export const VincularCelular = ({
  mandateId,
  nombre,
  trigger,
}: {
  mandateId: string;
  nombre: string;
  trigger: React.ReactElement;
}) => {
  const url = `${window.location.origin}${paths.maria.getHref(mandateId)}`;
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular {nombre}</DialogTitle>
          <DialogDescription>
            Desde ese celular, escanea este código con la cámara o abre Paygent
            y escribe el código. Necesita señal solo esta vez.
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-[15rem] rounded-2xl bg-paper-raised p-3">
          <QRCodeSVG
            value={url}
            level="M"
            marginSize={1}
            className="h-auto w-full"
            role="img"
            aria-label={`Código para vincular ${nombre}`}
          />
        </div>
        <p className="text-center text-sm text-ink-2">
          Código:{' '}
          <span className="num rounded-md bg-paper-sunken px-2 py-1 text-base text-grafito select-all">
            {mandateId}
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
};
