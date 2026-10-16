import { Head } from '@/components/seo';
import { Revelar } from '@/components/ui/revelar';
import { CelularAutoplay } from '@/features/celular/components/celular-autoplay';
import { Cierre } from '@/features/marketing/components/cierre';
import { ComoFunciona } from '@/features/marketing/components/como-funciona';
import { GatewayDecide } from '@/features/marketing/components/gateway-decide';
import { HeroPaisaje } from '@/features/marketing/components/hero-paisaje';
import { Problema } from '@/features/marketing/components/problema';
import { QueEs } from '@/features/marketing/components/que-es';
import { SinSenal } from '@/features/marketing/components/sin-senal';

// Portada con la estructura de Cofounder (Mobbin). Cada sección responde una
// pregunta del jurado, en orden: qué es → por qué hace falta → cómo funciona
// el mandato → cómo paga quien no tiene señal → por qué los agentes no se
// descontrolan. El hero recibe el celular (feature celular).
// Los id son las anclas del menú (landingSections en src/config/paths.ts).
const LandingRoute = () => {
  return (
    // overflow-x-clip: las secciones que entran desde un lado no deben
    // ensanchar la página (clip, no hidden, para no romper los sticky).
    <div className="overflow-x-clip">
      <Head />
      <HeroPaisaje telefono={(paso) => <CelularAutoplay paso={paso} />} />
      <div id="que-es" className="scroll-mt-16">
        <Revelar>
          <QueEs />
        </Revelar>
      </div>
      <Revelar desde="izquierda">
        <Problema />
      </Revelar>
      <div id="como-funciona" className="scroll-mt-16">
        <Revelar desde="escala">
          <ComoFunciona />
        </Revelar>
      </div>
      <div id="sin-senal" className="scroll-mt-16">
        <Revelar>
          <SinSenal />
        </Revelar>
      </div>
      <div id="agentes" className="scroll-mt-16">
        <Revelar desde="derecha">
          <GatewayDecide />
        </Revelar>
      </div>
      <Revelar desde="escala">
        <Cierre />
      </Revelar>
    </div>
  );
};

export default LandingRoute;
