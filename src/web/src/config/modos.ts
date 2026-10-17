import { type SpendMode } from '@/types/api';

// Qué es cada modo y cómo se usa desde la app: lo leen el titular (en su
// panel) y el beneficiario (en su billetera). Mismo texto en los dos lados.

export const MODOS: SpendMode[] = ['celular', 'asistente', 'sms'];

export const modoInfo: Record<
  SpendMode,
  { nombre: string; etiqueta: string; corto: string; como: string }
> = {
  celular: {
    nombre: 'Celular (vale QR)',
    etiqueta: 'Celular',
    corto: 'Paga con un QR, con o sin señal',
    como: 'En Mi billetera toca Pagar, elige la tienda y el monto, y muestra el QR. Con señal el tendero cobra al instante; sin señal, hasta el tope sin señal.',
  },
  asistente: {
    nombre: 'Asistente en la app',
    etiqueta: 'Asistente',
    corto: 'Pide en el chat y el Asistente compra',
    como: 'En Mi billetera toca Hablar con el asistente y pide lo que necesitas. Busca dónde hay, te propone la compra y paga; por encima del umbral te pide el PIN.',
  },
  sms: {
    nombre: 'SMS',
    etiqueta: 'SMS',
    corto: 'Compra por mensaje de texto, sin internet',
    como: 'Desde el celular registrado, aunque sea de teclas, escribe un SMS al número de Paygent con lo que necesitas. Cada compra se confirma con el PIN.',
  },
};
