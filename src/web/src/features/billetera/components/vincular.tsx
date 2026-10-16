import { ScanLine, Smartphone } from 'lucide-react';
import * as React from 'react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, Input } from '@/components/ui/form';
import { QrScanner } from '@/components/ui/qr-scanner';
import { useOnline } from '@/hooks/use-online';

import { useVincularDispositivo } from '../api/vincular-dispositivo';

// Enlazar este celular: se vuelve una rama del árbol de un titular (p. ej.
// "Celular de María"). El código lo muestra el titular en su cuenta (QR o
// texto). Necesita señal una sola vez.

const codigoSchema = z.object({
  codigo: z.string().trim().min(3, 'Escribe el código que te dieron'),
});

// El QR del titular es un enlace a /enlazar?codigo=<id> (antes
// /maria?vincular=<id>); también vale el id solo.
export const codigoDesdeQr = (texto: string) => {
  try {
    const { searchParams } = new URL(texto);
    return (
      searchParams.get('codigo') ?? searchParams.get('vincular') ?? texto.trim()
    );
  } catch {
    return texto.trim();
  }
};

export const Vincular = ({
  codigoInicial,
  encabezado = true,
}: {
  codigoInicial?: string;
  // Sin título propio cuando va dentro de un marco que ya lo tiene
  encabezado?: boolean;
}) => {
  const online = useOnline();
  const [escaneando, setEscaneando] = React.useState(false);
  const vincular = useVincularDispositivo();
  const intentado = React.useRef(false);

  // Llegó desde el QR del titular con la cámara del celular: enlaza sola.
  React.useEffect(() => {
    if (!codigoInicial || !online || intentado.current) return;
    intentado.current = true;
    vincular.mutate({ mandateId: codigoInicial });
  }, [codigoInicial, online, vincular]);

  return (
    <div
      className={encabezado ? 'flex flex-1 flex-col gap-6 pt-6' : 'space-y-5'}
    >
      {encabezado && (
        <div className="space-y-2">
          <span
            aria-hidden="true"
            className="inline-flex size-12 items-center justify-center rounded-2xl bg-firma-tint text-firma"
          >
            <Smartphone className="size-6" />
          </span>
          <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em] text-grafito">
            Enlaza este celular
          </h1>
          <p className="text-[0.9375rem] text-ink-2">
            Así pagas con el permiso que te dieron, incluso donde no hay señal.
            Solo lo haces una vez.
          </p>
        </div>
      )}

      {!online && (
        <p className="rounded-2xl bg-pendiente-tint p-4 text-sm text-pendiente">
          Para enlazarlo necesitas señal un momento. Después puedes pagar sin
          ella.
        </p>
      )}

      {escaneando ? (
        <div className="space-y-3">
          <QrScanner
            hint="Apunta al código que te muestra el titular"
            onScan={(texto) => {
              setEscaneando(false);
              vincular.mutate({ mandateId: codigoDesdeQr(texto) });
            }}
          />
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => setEscaneando(false)}
          >
            Escribir el código
          </Button>
        </div>
      ) : (
        <>
          <Button
            size="lg"
            className="w-full rounded-full"
            icon={<ScanLine aria-hidden="true" />}
            disabled={!online}
            isLoading={vincular.isPending}
            onClick={() => setEscaneando(true)}
          >
            Escanear el código
          </Button>
          <div className="flex items-center gap-3 text-xs text-ink-2">
            <span className="h-px flex-1 bg-rule" />o escríbelo
            <span className="h-px flex-1 bg-rule" />
          </div>
          <Form
            schema={codigoSchema}
            options={{ defaultValues: { codigo: codigoInicial ?? '' } }}
            onSubmit={({ codigo }) => vincular.mutate({ mandateId: codigo })}
          >
            {({ register, formState }) => (
              <>
                <Input
                  label="Código"
                  autoComplete="off"
                  autoCapitalize="none"
                  placeholder="maria-device"
                  className="num h-14 bg-paper-raised text-lg"
                  error={formState.errors.codigo}
                  registration={register('codigo')}
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full bg-paper-raised"
                  disabled={!online}
                  isLoading={vincular.isPending}
                >
                  Enlazar
                </Button>
              </>
            )}
          </Form>
        </>
      )}
    </div>
  );
};
