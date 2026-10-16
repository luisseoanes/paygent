import { useSearchParams } from 'react-router';

import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { CelularSms } from '@/features/celular/components/celular-sms';

// SMS-02: el celular de teclas de Doña Carmen, para la demo y el proyector. Usa
// el mismo endpoint que el SMS real, así que los pagos con PIN son reales.
// Sin login: un celular básico no tiene app ni cuenta, solo su número.
// ?tel=+57… simula el modo SMS de cualquier beneficiario registrado.
const TELEFONO_DEMO = '+573001112233';

const CelularRoute = () => {
  // En la URL el «+» llega como espacio: se le devuelve.
  const raw = useSearchParams()[0].get('tel')?.trim();
  const tel = raw && (raw.startsWith('+') ? raw : `+${raw}`);
  const telefono = tel || TELEFONO_DEMO;
  return (
    <AppShell
      rol={tel ? `Celular ${tel}` : 'Celular de Doña Carmen'}
      titular="Sin smartphone ni internet."
      titularPixel="Solo SMS."
      pasos={[
        'Doña Carmen le escribe al Asistente lo que necesita, como un SMS normal.',
        'El Asistente busca dónde lo venden y le propone la compra.',
        'Ella confirma con su PIN y Juan paga desde su billetera.',
      ]}
    >
      <Head
        title="Celular"
        description="El Asistente de Paygent por SMS, desde un celular de teclas."
      />
      <div className="flex flex-1 items-start justify-center px-4 py-6">
        <CelularSms telefono={telefono} />
      </div>
    </AppShell>
  );
};

export default CelularRoute;
