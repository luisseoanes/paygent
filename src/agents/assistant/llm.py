"""AG-02: Asistente con Claude tool use (bucle manual).

- El PIN nunca llega al modelo (lo intercepta router.py).
- Si el modelo falla o tarda más de LLM_TIMEOUT_S, router.py cae a las reglas (AG-04).
- El system prompt (prompt.py) es el mismo para todo beneficiario; cambia según el canal (app o SMS).
"""

import anthropic

from common.config import ANTHROPIC_MODEL, LLM_TIMEOUT_S

from . import prompt, replies, tools
from .session import Session

_client = anthropic.AsyncAnthropic(timeout=LLM_TIMEOUT_S, max_retries=0)

MAX_TURNS = 4
MAX_HISTORY = 30


async def handle(s: Session, text: str) -> str:
    system = prompt.system_prompt(s, s.mandato)  # la rama la leyó router.py; sin ella, el prompt va sin esos datos
    if len(s.history) > MAX_HISTORY:
        s.history = []  # conversación nueva; nunca editamos turnos anteriores
    start = len(s.history)
    s.history.append({"role": "user", "content": text})
    try:
        for _ in range(MAX_TURNS):
            response = await _client.beta.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=2048,
                system=system,
                tools=tools.TOOL_SCHEMAS,
                messages=s.history,
                output_config={"effort": "low"},  # chat y SMS: prima la latencia
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
