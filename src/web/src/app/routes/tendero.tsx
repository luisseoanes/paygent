import * as React from 'react';

import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Spinner } from '@/components/ui/spinner';
import { Caja } from '@/features/cobro/components/caja';
import { ElegirTienda } from '@/features/cobro/components/elegir-tienda';
import { Escanear } from '@/features/cobro/components/escanear';
import { MisCobros } from '@/features/cobro/components/mis-cobros';
import {
  type ResultadoEscaneo,
  Resultado,
} from '@/features/cobro/components/resultado';
import { useCaja } from '@/features/cobro/hooks/use-caja';
import { useCobroStore } from '@/features/cobro/stores/cobro-store';
import { avisar } from '@/features/cobro/utils/aviso';
import { verificarVale } from '@/features/cobro/utils/verificar';
import { ProtectedRoute, useUser } from '@/lib/auth';

// PWA del tendero (FE-04, OFF-05, OFF-06, OFF-08): escanear el vale del
// cliente, verificarlo sin red y cobrarlo (al instante con señal o cuando
// vuelva). El mismo QR sirve en los dos casos.

type Vista =
  | { tipo: 'caja' }
  | { tipo: 'escanear' }
  | { tipo: 'resultado'; resultado: ResultadoEscaneo };

const TenderoApp = () => {
  const { online, cargado, sincronizando } = useCaja();
  const merchantId = useCobroStore((s) => s.merchantId);
  const merchants = useCobroStore((s) => s.merchants);
  const tienda = merchants.find((m) => m.id === merchantId);
  const miTienda = useUser().data?.merchantId;
  const [vista, setVista] = React.useState<Vista>({ tipo: 'caja' });

  // La cuenta del tendero ya dice cuál es su tienda: no se elige a mano (ni se queda la de otra cuenta).
  React.useEffect(() => {
    if (
      cargado &&
      miTienda &&
      merchantId !== miTienda &&
      merchants.some((m) => m.id === miTienda)
    )
      void useCobroStore.getState().elegirTienda(miTienda);
  }, [cargado, miTienda, merchantId, merchants]);

  const leer = async (texto: string) => {
    const s = useCobroStore.getState();
    const check = verificarVale(texto, {
      gatewayPublicKey: s.gatewayPublicKey,
      merchant: s.merchants.find((m) => m.id === s.merchantId),
      vales: s.vales,
    });
    avisar(check.ok);
    if (!check.ok)
      return setVista({
        tipo: 'resultado',
        resultado: { ok: false, motivo: check.motivo },
      });
    await s.recibir(check.voucher);
    setVista({
      tipo: 'resultado',
      resultado: { ok: true, voucherId: check.voucher.voucherId },
    });
  };

  return (
    <AppShell
      rol="Tendero"
      titular="Cobra vales de Paygent."
      titularPixel="Con o sin señal."
      pasos={[
        'Escaneas el QR del vale que te muestra el cliente.',
        'La app lo verifica en el celular, sin internet, y te dice si lo aceptas.',
        'Con señal se cobra al instante; sin ella queda guardado y se cobra solo después.',
      ]}
    >
      <Head
        title="Tendero"
        description="Cobra vales de Paygent con o sin señal."
      />
      {!cargado ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : !merchantId ? (
        <ElegirTienda online={online} />
      ) : vista.tipo === 'escanear' ? (
        <Escanear
          onLeido={leer}
          onCancelar={() => setVista({ tipo: 'caja' })}
        />
      ) : vista.tipo === 'resultado' ? (
        <Resultado
          resultado={vista.resultado}
          online={online}
          sincronizando={sincronizando}
          onOtro={() => setVista({ tipo: 'escanear' })}
          onListo={() => setVista({ tipo: 'caja' })}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-8">
          <Caja
            online={online}
            sincronizando={sincronizando}
            onEscanear={() => setVista({ tipo: 'escanear' })}
          />
          {online && tienda && <MisCobros merchant={tienda} />}
        </div>
      )}
    </AppShell>
  );
};

const TenderoRoute = () => (
  <ProtectedRoute rol="tendero">
    <TenderoApp />
  </ProtectedRoute>
);

export default TenderoRoute;
