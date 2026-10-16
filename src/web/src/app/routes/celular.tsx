import { AppShell } from '@/components/layouts';
import { Head } from '@/components/seo';
import { CelularSms } from '@/features/celular/components/celular-sms';

// SMS-02: el celular de teclas de Doña Carmen, para la demo y el proyector. Usa
// el mismo endpoint que el SMS real, así que los pagos con PIN son reales.
// Sin login: un celular básico no tiene app ni cuenta, solo su número.
const TELEFONO_DEMO = '+573001112233';

const CelularRoute = () => (
  <AppShell
    rol="Celular de Doña Carmen"
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
      <CelularSms telefono={TELEFONO_DEMO} />
    </div>
  </AppShell>
);

export default CelularRoute;
