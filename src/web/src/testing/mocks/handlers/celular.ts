import { HttpResponse, http } from 'msw';

import { apiUrl, networkDelay } from '../utils';

// SMS-02: el Asistente simulado. Responde como src/api POST /sms/inbound (rama de reglas).
export const celularHandlers = [
  http.post(apiUrl('/sms/inbound'), async ({ request }) => {
    await networkDelay();
    const { Body } = (await request.json()) as { From: string; Body: string };
    const texto = Body.trim().toLowerCase();
    if (/^\d{4,6}$/.test(texto))
      return HttpResponse.json({
        reply:
          'Listo, pagado. Recoja Losartán 50 mg x30 en Farmacia San José con el código 8899.',
      });
    if (texto.includes('presi'))
      return HttpResponse.json({
        reply:
          'Farmacia San José: Losartán 50 mg x30 a $12.000 para recoger. Responda con su PIN para pagar o NO para cancelar.',
      });
    return HttpResponse.json({
      reply:
        'No entendí. Escriba qué necesita, por ejemplo: pastilla de la presión.',
    });
  }),
];
