import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

// Visor de cámara a lo ancho, oscuro y con esquinas (patrón Cash App/Fuse).
// Llama a onScan una sola vez por lectura. Necesita HTTPS o localhost.

export type QrScannerProps = {
  onScan: (text: string) => void;
  hint?: string;
  className?: string;
};

const Esquina = ({ className }: { className: string }) => (
  <span
    aria-hidden="true"
    className={cn('absolute size-10 border-paper-raised', className)}
  />
);

export const QrScanner = ({
  onScan,
  hint = 'Apunta al código QR',
  className,
}: QrScannerProps) => {
  const id = React.useId().replace(/:/g, '');
  const onScanRef = React.useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    const scanner = new Html5Qrcode(`qr-${id}`, { verbose: false });
    let leido = false;
    let activo = false;
    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const lado = Math.floor(Math.min(w, h) * 0.8);
            return { width: lado, height: lado };
          },
        },
        (text) => {
          if (leido) return;
          leido = true;
          navigator.vibrate?.(60);
          onScanRef.current(text);
        },
        () => {},
      )
      .then(() => {
        activo = true;
      })
      .catch(() =>
        setError(
          'No pudimos abrir la cámara. Da permiso en el navegador o pega el código.',
        ),
      );
    return () => {
      if (activo) scanner.stop().catch(() => {});
    };
  }, [id]);

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-3xl bg-grafito',
        className,
      )}
    >
      <div
        id={`qr-${id}`}
        className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-paper-raised">
          <CameraOff className="size-8" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : (
        <>
          <Esquina className="top-[10%] left-[10%] rounded-tl-2xl border-t-4 border-l-4" />
          <Esquina className="top-[10%] right-[10%] rounded-tr-2xl border-t-4 border-r-4" />
          <Esquina className="bottom-[10%] left-[10%] rounded-bl-2xl border-b-4 border-l-4" />
          <Esquina className="right-[10%] bottom-[10%] rounded-br-2xl border-r-4 border-b-4" />
          <p className="absolute inset-x-0 bottom-3 text-center text-sm text-paper-raised">
            {hint}
          </p>
        </>
      )}
    </div>
  );
};
