import { Head } from '@/components/seo';
import { CelularAutoplay } from '@/features/celular/components/celular-autoplay';
import { Cierre } from '@/features/marketing/components/cierre';
import { ComoFunciona } from '@/features/marketing/components/como-funciona';
import { GatewayDecide } from '@/features/marketing/components/gateway-decide';
import { HeroPaisaje } from '@/features/marketing/components/hero-paisaje';
import { Problema } from '@/features/marketing/components/problema';
import { QueEs } from '@/features/marketing/components/que-es';
import { QueEsReal } from '@/features/marketing/components/que-es-real';
import { SinSenal } from '@/features/marketing/components/sin-senal';

// Portada con la estructura de Cofounder (Mobbin). Cada sección responde una
// pregunta del jurado, en orden: qué es → por qué hace falta → cómo funciona
// el mandato → por qué los agentes no se descontrolan → cómo paga quien no
// tiene señal → qué es real. El hero recibe el celular (feature celular).
// Los id son las anclas del menú (landingSections en src/config/paths.ts).
const LandingRoute = () => {
  return (
    <>
      <Head />
      <HeroPaisaje telefono={(paso) => <CelularAutoplay paso={paso} />} />
      <div id="que-es" className="scroll-mt-16">
        <QueEs />
      </div>
      <Problema />
      <div id="como-funciona" className="scroll-mt-16">
        <ComoFunciona />
      </div>
      <div id="agentes" className="scroll-mt-16">
        <GatewayDecide />
      </div>
      <div id="sin-senal" className="scroll-mt-16">
        <SinSenal />
      </div>
      <div id="que-es-real" className="scroll-mt-16">
        <QueEsReal />
      </div>
      <Cierre />
    </>
  );
};

export default LandingRoute;
