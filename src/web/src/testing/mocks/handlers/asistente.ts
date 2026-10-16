import { HttpResponse, delay, http } from 'msw';

import { apiUrl } from '../utils';

// Asistente simulado: responde en streaming (texto plano por trozos) igual que
// el contrato de POST /asistente/chat que implementará src/agents.

type Peticion = { mensajes: { rol: string; texto: string }[] };

const responder = (pregunta: string) => {
  const p = pregunta.toLowerCase();
  if (/(queda|saldo|gastar|cu[aá]nto)/.test(p))
    return 'Este mes te quedan $88,00 del permiso de Juan. Sin señal puedes gastar hasta $8,00 desde este celular; se renueva cuando vuelva la conexión.';
  if (/(pastilla|presi[oó]n|losart|farmacia|medicina)/.test(p))
    return 'Encontré losartán en Farmacia San José, a 3 cuadras, por $12.000. Si quieres, preparo el pago y tú lo confirmas con tu PIN.';
  if (/(señal|internet|offline|sin se)/.test(p))
    return 'Sí. Tu celular firma un vale con su llave y el tendero lo cobra al volver la señal. Nadie retiene el dinero en el medio.';
  return 'Puedo ayudarte a saber cuánto te queda, encontrar dónde comprar o explicarte cómo pagar sin señal. ¿Qué necesitas?';
};

const enTest = import.meta.env.MODE === 'test';

export const asistenteHandlers = [
  http.post(apiUrl('/asistente/chat'), async ({ request }) => {
    const { mensajes } = (await request.json()) as Peticion;
    const texto = responder(mensajes.at(-1)?.texto ?? '');
    const encoder = new TextEncoder();
    const trozos = texto.match(/.{1,12}/gs) ?? [];

    if (!enTest) await delay(900);
    const stream = new ReadableStream({
      async start(controller) {
        for (const t of trozos) {
          controller.enqueue(encoder.encode(t));
          if (!enTest) await delay(60);
        }
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }),
];
