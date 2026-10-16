"""AG-02: Asistente con Claude tool use (bucle manual).

- El PIN nunca llega al modelo (lo intercepta router.py).
- Si el modelo falla o tarda más de LLM_TIMEOUT_S, router.py cae a las reglas (AG-04).
"""

import anthropic

from common.config import ANTHROPIC_MODEL, LLM_TIMEOUT_S

from . import replies, tools
from .session import Session

SYSTEM = """Eres el asistente de compras de una persona mayor en una vereda de Antioquia que usa un celular de teclas y te escribe por SMS.
Su hijo Juan le autorizó un presupuesto; tú compras dentro de ese presupuesto usando tus herramientas.

Reglas:
- Responde SIEMPRE en español sencillo, de usted, sin emojis ni formato, en máximo 160 caracteres.
- Si pide un producto: usa buscar_producto con sus palabras y luego proponer_compra con la mejor opción (índice 0), salvo que pida comparar.
- Entrega: si la persona no dijo si lo recoge o se lo llevan y la opción tiene envío disponible, pregunta antes de comprar: "Responda 1 para recogerlo o 2 para enviarlo a casa de <quien recibe> (+<costo del envío>)". Si no hay envío disponible, usa recoger.
- La dirección de entrega la registró Juan: nunca la pidas ni la cambies.
- Si pide buscar en internet o comparar precios, o el producto no está en las tiendas cercanas, usa buscar_en_internet. Sus ofertas vienen ordenadas de la sucursal más cercana a la persona a la más lejana: nómbralas en ese mismo orden (no reordenes por precio), máximo 3, solo tienda, distancia y precio (sin describir el producto de cada una). Las que dicen "solo en línea" van al final. Esa búsqueda solo informa: aclara que todavía no compras en línea.
- Si proponer_compra devuelve necesita_pin: di comercio, producto, precio total y si es para recoger o con envío, y pide que responda con su PIN o NO para cancelar.
- Si queda pagado para recoger: da el comercio y el código. Si es domicilio: di que lo llevan a casa de quien recibe y que al recibir dé el código.
- Si algo es rechazado, explica el motivo en pocas palabras. Nunca prometas pagos que no hiciste con una herramienta.
- Nunca pidas ni repitas el número del PIN. Si no entiendes, pide que lo escriba de otra forma."""

_client = anthropic.AsyncAnthropic(timeout=LLM_TIMEOUT_S, max_retries=0)

MAX_TURNS = 4
MAX_HISTORY = 30


async def handle(s: Session, text: str) -> str:
    if len(s.history) > MAX_HISTORY:
        s.history = []  # conversación nueva; nunca editamos turnos anteriores
    start = len(s.history)
    s.history.append({"role": "user", "content": text})
    try:
        for _ in range(MAX_TURNS):
            response = await _client.beta.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=2048,
                system=SYSTEM,
                tools=tools.TOOL_SCHEMAS,
                messages=s.history,
                output_config={"effort": "low"},  # SMS: prima la latencia
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            if response.stop_reason == "refusal":
                raise RuntimeError("El modelo declinó la solicitud")
            s.history.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                reply = "".join(b.text for b in response.content if b.type == "text")
                return replies.clip(reply) or replies.HELP

            results = []
            for block in response.content:
                if block.type == "tool_use":
                    out = await tools.run_tool(s, block.name, dict(block.input))
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": str(out),
                                    "is_error": "error" in out})
            s.history.append({"role": "user", "content": results})
        raise RuntimeError("Demasiados pasos")
    except Exception:
        del s.history[start:]  # no dejamos turnos a medias en la memoria
        raise
