import { env } from '@/config/env';

import { type PuertoChat } from '../types';

// Puerto por defecto: POST {API_URL}/asistente/chat con { mensajes, contexto }.
// El backend responde texto plano en streaming (chunked); cada trozo se pinta
// al llegar. Una respuesta JSON { texto } también sirve (sin streaming).
export const RUTA_CHAT = '/asistente/chat';

export const puertoHttp: PuertoChat = {
  enviar: async (peticion, { signal, onTrozo }) => {
    const res = await fetch(`${env.API_URL}${RUTA_CHAT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(peticion),
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error(`El asistente respondió ${res.status}`);

    if (res.headers.get('content-type')?.includes('application/json')) {
      const { texto } = (await res.json()) as { texto: string };
      onTrozo(texto);
      return;
    }
    if (!res.body) {
      onTrozo(await res.text());
      return;
    }
    const lector = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      onTrozo(decoder.decode(value, { stream: true }));
    }
  },
};
