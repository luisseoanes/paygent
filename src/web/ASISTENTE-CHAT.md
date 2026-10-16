# Chat con el asistente: cómo conectarlo

El frontend ya está listo: botón "Hablar con el asistente" en `/maria`, chat con
streaming letra a letra, errores y reintento. Solo falta el endpoint.

## Contrato

```
POST /api/asistente/chat
Content-Type: application/json

{
  "mensajes": [
    { "rol": "usuario",   "texto": "¿Cuánto me queda?" },
    { "rol": "asistente", "texto": "Te quedan $88,00." },
    { "rol": "usuario",   "texto": "¿Dónde compro losartán?" }
  ],
  "contexto": { "mandato": "mnd_maria_cel" }
}
```

- `mensajes`: el historial completo, el último es la pregunta nueva.
- `contexto.mandato`: id del sub-mandato de María. Úsalo para consultar el gateway.

**Respuesta** (una de las dos):

1. **Streaming (recomendado):** `Content-Type: text/plain`, texto plano por trozos.
   La UI pinta cada trozo al llegar.
2. **Sin streaming:** `Content-Type: application/json` con `{ "texto": "..." }`.

> ⚠️ No uses formato SSE (`data: ...`): el frontend lee texto plano y se vería `data:` en el chat.

Cualquier status distinto de 2xx muestra el error con un botón "Reintentar".
Si el usuario pulsa "Detener", el frontend aborta el fetch.

## Por dónde pasa

`/api` va por el proxy de Vite a **`src/api` (Fastify, :3001)**, no a los agentes.
Lo más simple: una ruta en Fastify que reenvíe a `src/agents` (:8000) y devuelva el stream.

### Fastify (`src/api`)

```ts
app.post('/asistente/chat', async (req, reply) => {
  const res = await fetch(`${AGENTS_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  });
  reply.header('Content-Type', 'text/plain; charset=utf-8');
  return reply.send(res.body); // reenvía el stream tal cual
});
```

### FastAPI (`src/agents`)

```python
from fastapi.responses import StreamingResponse

@app.post("/assistant/chat")
async def chat(peticion: PeticionChat):
    async def trozos():
        async for texto in responder(peticion):  # LLM o rules.py
            yield texto
    return StreamingResponse(trozos(), media_type="text/plain")
```

## Importante

- **El PIN puede venir escrito en un mensaje.** `assistant/router.py` debe interceptarlo
  antes del LLM (regla del `CLAUDE.md`).
- **El asistente propone, no paga.** Cualquier pago pasa por `/pay` del gateway.
- **Para probar el backend real**, pon `VITE_APP_ENABLE_API_MOCKING=false`; si no, el mock
  de `src/testing/mocks/handlers/asistente.ts` responde en su lugar.

## Archivos del frontend

| Archivo | Qué hace |
|---|---|
| `src/features/asistente/types/index.ts` | Contrato (`PuertoChat`, mensajes) |
| `src/features/asistente/api/puerto-http.ts` | Llamada HTTP + lectura del stream |
| `src/features/asistente/hooks/use-chat.ts` | Estado, "pensando", letra a letra |
| `src/features/asistente/components/` | UI del chat y la nube |

¿Otro transporte (SSE, WebSocket)? Escribe otro objeto que cumpla `PuertoChat` y pásalo a
`useChat({ puerto })`. La UI no cambia.
