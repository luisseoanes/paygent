import { type EstadoVale } from '../stores/cobro-store';

// Cómo se nombra y se marca cada estado de un vale en la caja.
export const estadoVale: Record<
  EstadoVale,
  {
    label: string;
    sello: 'liquidado' | 'rechazado' | 'pendiente';
    chip: string;
  }
> = {
  pending: {
    label: 'Por cobrar',
    sello: 'pendiente',
    chip: 'border-dashed border-pendiente-borde bg-pendiente-tint text-pendiente',
  },
  settled: {
    label: 'Cobrado',
    sello: 'liquidado',
    chip: 'border-transparent bg-liquidado-tint text-liquidado',
  },
  flagged: {
    label: 'Cobrado con alerta',
    sello: 'liquidado',
    chip: 'border-pendiente-borde bg-pendiente-tint text-pendiente',
  },
  rejected: {
    label: 'Rechazado',
    sello: 'rechazado',
    chip: 'border-transparent bg-anulado-tint text-anulado',
  },
};
