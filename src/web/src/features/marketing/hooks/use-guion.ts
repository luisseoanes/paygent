import { useReducedMotion } from 'motion/react';
import * as React from 'react';

// Reloj del guion del hero: avanza por pasos con su duración y vuelve a
// empezar. Con movimiento reducido se queda en el último paso (estado final).

export const PASOS = {
  espera: 0,
  escribiendo: 1,
  consultando: 2,
  oferta: 3,
  pin: 4,
  pagado: 5,
} as const;

const DURACIONES = [900, 2000, 1800, 2600, 1400, 3800];
const ULTIMO = DURACIONES.length - 1;

export const useGuion = () => {
  const reduceMotion = useReducedMotion();
  const [paso, setPaso] = React.useState(0);
  const [vuelta, setVuelta] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) return;
    const id = setTimeout(() => {
      if (paso === ULTIMO) {
        setPaso(0);
        setVuelta((v) => v + 1);
      } else {
        setPaso(paso + 1);
      }
    }, DURACIONES[paso]);
    return () => clearTimeout(id);
  }, [paso, reduceMotion]);

  return { paso: reduceMotion ? ULTIMO : paso, vuelta };
};
