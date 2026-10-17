import { amount as A, type Merchant, type Voucher } from '@openroute/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';

import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { ConfirmationDialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { ChatAsistente } from '@/features/asistente/components/chat-asistente';
import { NubeChat } from '@/features/asistente/components/nube-chat';
import { useChat } from '@/features/asistente/hooks/use-chat';
import { FormasDePagar } from '@/features/billetera/components/formas-de-pagar';
import { InicioBilletera } from '@/features/billetera/components/inicio-billetera';
import { Pagar } from '@/features/billetera/components/pagar';
import { ValeQr } from '@/features/billetera/components/vale-qr';
import { Vincular } from '@/features/billetera/components/vincular';
import { useRefrescarDispositivo } from '@/features/billetera/hooks/use-refrescar-dispositivo';
import { useDispositivoStore } from '@/features/billetera/stores/dispositivo-store';
import { esDeLaCuenta } from '@/features/billetera/utils/cuenta';
import { useModes } from '@/features/mandates/api/modes';
import { HistorialRama } from '@/features/mandates/components/historial-rama';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ProtectedRoute, useUser } from '@/lib/auth';

// App del beneficiario (FE-03, OFF-04): con el celular enlazado ve cuánto
// puede gastar y paga con un vale firmado en el teléfono, con o sin señal.
// Si entra desde otro celular, lo enlaza con el código de su cuenta.

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'pagar' }
  | { tipo: 'vale'; voucher: Voucher; merchant: Merchant; cop: number };

const BilleteraApp = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useUser().data;
  const cargado = useDispositivoStore((s) => s.cargado);
  const guardado = useDispositivoStore((s) => s.dispositivo);
  // Otro beneficiario pudo enlazar su celular en este navegador: ese no se muestra.
  const dispositivo =
    guardado && esDeLaCuenta(guardado, user) ? guardado : null;
  const cargar = useDispositivoStore((s) => s.cargar);
  const olvidar = useDispositivoStore((s) => s.olvidar);
  const [vista, setVista] = React.useState<Vista>({ tipo: 'inicio' });
  // ?vincular= de QR viejos o la rama con la que se registró la cuenta
  const codigo = searchParams.get('vincular') ?? user?.mandateId;
  // Chat del asistente o historial: uno a la vez (en PC comparten la nube).
  const [panel, setPanel] = React.useState<'chat' | 'historial' | null>(null);
  const escritorio = useMediaQuery('(min-width: 1024px)');
  const contexto = React.useMemo(
    () => (dispositivo ? { mandato: dispositivo.mandateId } : undefined),
    [dispositivo],
  );
  const chat = useChat({ contexto });
  const modosQuery = useModes({ mandateId: dispositivo?.mandateId });
  const modos = modosQuery.data?.modes;
  // Sin datos (p. ej. sin señal) no se esconde: el chat dirá si no está habilitado.
  const conAsistente = !modos || modos.some((m) => m.mode === 'asistente');
  const cerrarPanel = () => setPanel(null);
  const chatVisible = panel === 'chat' && !!dispositivo;
  const historialVisible = panel === 'historial' && !!dispositivo;
  // La rama de la persona: abarca su celular, su Asistente y su SMS.
  const ramaHistorial =
    modosQuery.data?.personaId ?? user?.mandateId ?? dispositivo?.mandateId;
  useRefrescarDispositivo({ activo: !!dispositivo });

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  // Ya vinculado: el ?vincular= de la URL sobra.
  React.useEffect(() => {
    if (dispositivo && searchParams.has('vincular'))
      setSearchParams({}, { replace: true });
  }, [dispositivo, searchParams, setSearchParams]);

  return (
    <AppShell
      rol="Beneficiario"
      titular="Un permiso para pagar, en tu celular."
      titularPixel="Paga aunque no haya señal."
      pasos={[
        'Enlazas el celular una vez con el código que te dio el titular.',
        'Eliges dónde pagas y cuánto, en pesos.',
        'Muestras el QR del vale: el tendero lo cobra al instante o cuando vuelva la señal.',
      ]}
      escenaKey={panel ?? undefined}
      escena={
        !escritorio ? undefined : chatVisible ? (
          <NubeChat>
            <ChatAsistente
              chat={chat}
              onCerrar={cerrarPanel}
              className="h-[min(68dvh,560px)]"
            />
          </NubeChat>
        ) : historialVisible && ramaHistorial ? (
          <NubeChat>
            <HistorialRama
              mandateId={ramaHistorial}
              titulo="Mi historial"
              onCerrar={cerrarPanel}
              className="h-[min(68dvh,560px)]"
            />
          </NubeChat>
        ) : undefined
      }
    >
      <Head
        title="Mi billetera"
        description="Paga con el permiso que te dieron, con o sin señal."
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
          onCerrar={cerrarPanel}
          className="h-[calc(100dvh-7rem)]"
        />
      ) : historialVisible && !escritorio && ramaHistorial ? (
        <HistorialRama
          mandateId={ramaHistorial}
          titulo="Mi historial"
          onVolver={cerrarPanel}
          className="h-[calc(100dvh-7rem)] pt-2"
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
          onOtroPago={() => setVista({ tipo: 'pagar' })}
        />
      ) : (
        <InicioBilletera
          dispositivo={dispositivo}
          onPagar={() => setVista({ tipo: 'pagar' })}
          onAsistente={conAsistente ? () => setPanel('chat') : undefined}
          onHistorial={() => setPanel('historial')}
          formasDePagar={
            modos && (
              <FormasDePagar
                modos={modos}
                aCop={(a) => A.toCop(a, dispositivo.fx)}
              />
            )
          }
          desvincular={
            <ConfirmationDialog
              title="¿Desvincular este celular?"
              body="Se borran sus llaves. Para volver a pagar tendrás que enlazarlo otra vez con el código de tu titular."
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

const BilleteraRoute = () => (
  <ProtectedRoute rol="beneficiario">
    <BilleteraApp />
  </ProtectedRoute>
);

export default BilleteraRoute;
