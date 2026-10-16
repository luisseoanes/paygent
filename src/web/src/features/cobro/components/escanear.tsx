import { ArrowLeft, ClipboardPaste } from 'lucide-react';
import * as React from 'react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, Textarea } from '@/components/ui/form';
import { QrScanner } from '@/components/ui/qr-scanner';

// Escanear el vale del cliente. "Pegar vale" sirve para la demo en un
// computador sin cámara (el vale se copia desde la app de María).

const pegarSchema = z.object({
  vale: z.string().trim().min(10, 'Pega el vale completo'),
});

export const Escanear = ({
  onLeido,
  onCancelar,
}: {
  onLeido: (texto: string) => void;
  onCancelar: () => void;
}) => {
  const [pegar, setPegar] = React.useState(false);

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <button
        type="button"
        onClick={onCancelar}
        className="-ml-2 inline-flex min-h-12 items-center gap-1.5 self-start rounded-full px-2 text-sm text-ink-2 hover:text-grafito"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Caja
      </button>
      <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em] text-grafito">
        Escanea el vale
      </h1>
      {pegar ? (
        <Form schema={pegarSchema} onSubmit={({ vale }) => onLeido(vale)}>
          {({ register, formState }) => (
            <>
              <Textarea
                label="Vale"
                rows={6}
                className="num bg-paper-raised text-xs"
                error={formState.errors.vale}
                registration={register('vale')}
              />
              <Button type="submit" size="lg" className="w-full rounded-full">
                Verificar vale
              </Button>
            </>
          )}
        </Form>
      ) : (
        <QrScanner hint="Apunta al QR del cliente" onScan={onLeido} />
      )}
      <Button
        variant="ghost"
        className="w-full rounded-full"
        icon={pegar ? undefined : <ClipboardPaste aria-hidden="true" />}
        onClick={() => setPegar((v) => !v)}
      >
        {pegar ? 'Usar la cámara' : 'Pegar vale (demo en computador)'}
      </Button>
    </div>
  );
};
