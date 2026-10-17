// Reglas de la rama de un agente para la demo de la portada, con la misma
// lógica que aplica el gateway: estado de la rama, categorías, tope por compra
// o acumulado del periodo, y PIN sobre el umbral.

export type Periodo = 'compra' | 'semana' | 'mes';
export type EstadoRama = 'activa' | 'congelada' | 'revocada';

export type Intento = { que: string; monto: number; categoria: string };

export type Veredicto =
  { tipo: 'aprobado'; conPin: boolean } | { tipo: 'rechazado'; motivo: string };

export const UMBRAL_PIN = 10;

export const evaluarIntentos = (
  intentos: Intento[],
  regla: {
    tope: number;
    periodo: Periodo;
    estado: EstadoRama;
    categorias: string[];
  },
): { intento: Intento; veredicto: Veredicto }[] => {
  let gastado = 0;
  return intentos.map((intento) => {
    const rechazo = (motivo: string) => ({
      intento,
      veredicto: { tipo: 'rechazado', motivo } as const,
    });
    if (regla.estado === 'congelada') return rechazo('Rama congelada');
    if (regla.estado === 'revocada') return rechazo('Rama revocada');
    if (!regla.categorias.includes(intento.categoria))
      return rechazo('Fuera de sus categorías');
    const base = regla.periodo === 'compra' ? 0 : gastado;
    if (base + intento.monto > regla.tope)
      return rechazo(
        regla.periodo === 'compra'
          ? 'Pasa el tope por compra'
          : regla.periodo === 'semana'
            ? 'Pasa el tope de la semana'
            : 'Pasa el tope del mes',
      );
    gastado += intento.monto;
    return {
      intento,
      veredicto: { tipo: 'aprobado', conPin: intento.monto > UMBRAL_PIN },
    };
  });
};

// Lo que lleva gastado la rama con los pagos aprobados.
export const gastoAprobado = (resultado: ReturnType<typeof evaluarIntentos>) =>
  resultado.reduce(
    (s, r) => (r.veredicto.tipo === 'aprobado' ? s + r.intento.monto : s),
    0,
  );
