import { type Merchant, type Voucher } from '@openroute/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';

import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { ChatAsistente } from '@/features/asistente/components/chat-asistente';
import { NubeChat } from '@/features/asistente/components/nube-chat';
import { useChat } from '@/features/asistente/hooks/use-chat';
import { InicioBilletera } from '@/features/billetera/components/inicio-billetera';
import { Pagar } from '@/features/billetera/components/pagar';
import { ValeQr } from '@/features/billetera/components/vale-qr';
import { Vincular } from '@/features/billetera/components/vincular';
import { useRefrescarDispositivo } from '@/features/billetera/hooks/use-refrescar-dispositivo';
import { useDispositivoStore } from '@/features/billetera/stores/dispositivo-store';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ProtectedRoute } from '@/lib/auth';

// PWA de María (FE-03, OFF-04): vincular el celular una vez, ver cuánto puede
// gastar y pagar con un vale firmado en el teléfono, con o sin señal.

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'pagar' }
  | { tipo: 'vale'; voucher: Voucher; merchant: Merchant; cop: number };

const MariaApp = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const cargado = useDispositivoStore((s) => s.cargado);
  const dispositivo = useDispositivoStore((s) => s.dispositivo);
  const cargar = useDispositivoStore((s) => s.cargar);
  const olvidar = useDispositivoStore((s) => s.olvidar);
  const [vista, setVista] = React.useState<Vista>({ tipo: 'inicio' });
  const codigo = searchParams.get('vincular') ?? undefined;
  const [chatAbierto, setChatAbierto] = React.useState(false);
  const escritorio = useMediaQuery('(min-width: 1024px)');
  const contexto = React.useMemo(
    () => (dispositivo ? { mandato: dispositivo.mandateId } : undefined),
    [dispositivo],
  );
  const chat = useChat({ contexto });
  const cerrarChat = () => setChatAbierto(false);
  const chatVisible = chatAbierto && !!dispositivo;
  useRefrescarDispositivo();

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  // Ya vinculado: el ?vincular= de la URL sobra.
  React.useEffect(() => {
    if (dispositivo && codigo) setSearchParams({}, { replace: true });
  }, [dispositivo, codigo, setSearchParams]);

  return (
    <AppShell
      rol="María"
      titular="El permiso de Juan, en tu celular."
      titularPixel="Paga aunque no haya señal."
      pasos={[
        'Vinculas el celular una vez con el código que te da Juan.',
        'Eliges dónde pagas y cuánto, en pesos.',
        'Muestras el QR del vale: el tendero lo cobra al instante o cuando vuelva la señal.',
      ]}
      escena={
        chatVisible && escritorio ? (
          <NubeChat>
            <ChatAsistente
              chat={chat}
              onCerrar={cerrarChat}
              className="h-[min(68dvh,560px)]"
            />
          </NubeChat>
        ) : undefined
      }
    >
      <Head
        title="María"
        description="Paga con el permiso de Juan, con o sin señal."
      />
      {!cargado ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : !dispositivo ? (
        <Vincular codigoInicial={codigo} />
      ) : chatVisible && !escritorio ? (
        <ChatAsistente
          chat={chat}
          onCerrar={cerrarChat}
          className="h-[calc(100dvh-7rem)]"
        />
      ) : vista.tipo === 'pagar' ? (
        <Pagar
          dispositivo={dispositivo}
          onCancelar={() => setVista({ tipo: 'inicio' })}
          onVale={(voucher, merchant, cop) =>
            setVista({ tipo: 'vale', voucher, merchant, cop })
          }
        />
      ) : vista.tipo === 'vale' ? (
        <ValeQr
          voucher={vista.voucher}
          merchant={vista.merchant}
          cop={vista.cop}
          onListo={() => setVista({ tipo: 'inicio' })}
        />
      ) : (
        <InicioBilletera
          dispositivo={dispositivo}
          onPagar={() => setVista({ tipo: 'pagar' })}
          onAsistente={() => setChatAbierto(true)}
          desvincular={
            <ConfirmationDialog
              title="¿Desvincular este celular?"
              body="Se borran sus llaves. Para volver a pagar tendrás que vincularlo otra vez con el código de Juan."
              confirmLabel="Desvincular"
              onConfirm={() => olvidar()}
              triggerButton={
                <button
                  type="button"
                  className="mx-auto min-h-10 text-xs text-ink-2 underline underline-offset-2 hover:text-grafito"
                >
                  Desvincular este celular
                </button>
              }
            />
          }
        />
      )}
    </AppShell>
  );
};

const MariaRoute = () => (
  <ProtectedRoute rol="maria">
    <MariaApp />
  </ProtectedRoute>
);

export default MariaRoute;
