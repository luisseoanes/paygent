import { ScanLine, Smartphone } from 'lucide-react';
import * as React from 'react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, Input } from '@/components/ui/form';
import { QrScanner } from '@/components/ui/qr-scanner';
import { useOnline } from '@/hooks/use-online';

import { useVincularDispositivo } from '../api/vincular-dispositivo';

// Primera vez: este celular se vuelve la rama "Celular de María" del árbol de
// Juan. El código lo muestra Juan en su panel (QR o texto). Necesita señal.

const codigoSchema = z.object({
  codigo: z.string().trim().min(3, 'Escribe el código que te dio Juan'),
});

// El QR de Juan es un enlace a /maria?vincular=<id>; también vale el id solo.
export const codigoDesdeQr = (texto: string) => {
  try {
    return new URL(texto).searchParams.get('vincular') ?? texto.trim();
  } catch {
    return texto.trim();
  }
};

export const Vincular = ({ codigoInicial }: { codigoInicial?: string }) => {
  const online = useOnline();
  const [escaneando, setEscaneando] = React.useState(false);
  const vincular = useVincularDispositivo();
  const intentado = React.useRef(false);

  // Llegó desde el QR de Juan con la cámara del celular: vincula sola.
  React.useEffect(() => {
    if (!codigoInicial || !online || intentado.current) return;
    intentado.current = true;
    vincular.mutate({ mandateId: codigoInicial });
  }, [codigoInicial, online, vincular]);

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <div className="space-y-2">
        <span
          aria-hidden="true"
          className="inline-flex size-12 items-center justify-center rounded-2xl bg-firma-tint text-firma"
        >
          <Smartphone className="size-6" />
        </span>
        <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em] text-grafito">
          Vincula este celular
        </h1>
        <p className="text-[0.9375rem] text-ink-2">
          Así pagas con el permiso que te dio Juan, incluso donde no hay señal.
          Solo lo haces una vez.
        </p>
      </div>

      {!online && (
        <p className="rounded-2xl bg-pendiente-tint p-4 text-sm text-pendiente">
          Para vincularlo necesitas señal un momento. Después puedes pagar sin
          ella.
        </p>
      )}

      {escaneando ? (
        <div className="space-y-3">
          <QrScanner
            hint="Apunta al código del panel de Juan"
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
            Escanear el código de Juan
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
                  Vincular
                </Button>
              </>
            )}
          </Form>
        </>
      )}
    </div>
  );
};
