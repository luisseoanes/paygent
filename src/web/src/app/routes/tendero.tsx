import * as React from 'react';

import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Spinner } from '@/components/ui/spinner';
import { Caja } from '@/features/cobro/components/caja';
import { ElegirTienda } from '@/features/cobro/components/elegir-tienda';
import { Escanear } from '@/features/cobro/components/escanear';
import {
  type ResultadoEscaneo,
  Resultado,
} from '@/features/cobro/components/resultado';
import { useCaja } from '@/features/cobro/hooks/use-caja';
import { useCobroStore } from '@/features/cobro/stores/cobro-store';
import { avisar } from '@/features/cobro/utils/aviso';
import { verificarVale } from '@/features/cobro/utils/verificar';

// PWA del tendero (FE-04, OFF-05, OFF-06, OFF-08): escanear el vale del
// cliente, verificarlo sin red y cobrarlo (al instante con señal o cuando
// vuelva). El mismo QR sirve en los dos casos.

type Vista =
  | { tipo: 'caja' }
  | { tipo: 'escanear' }
  | { tipo: 'resultado'; resultado: ResultadoEscaneo };

const TenderoRoute = () => {
  const { online, cargado, sincronizando } = useCaja();
  const merchantId = useCobroStore((s) => s.merchantId);
  const [vista, setVista] = React.useState<Vista>({ tipo: 'caja' });

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
    <AppShell rol="Tendero">
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
        <Caja
          online={online}
          sincronizando={sincronizando}
          onEscanear={() => setVista({ tipo: 'escanear' })}
        />
      )}
    </AppShell>
  );
};

export default TenderoRoute;
