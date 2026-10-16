"""Configuración compartida. Lee el mismo .env de la raíz que usa la api."""

import os
from pathlib import Path

from dotenv import load_dotenv

# En local la raíz del repo es parents[3]. En Railway el servicio se construye desde src/agents
# (/app/common/config.py): ese nivel no existe y las variables llegan del entorno, no de un .env.
_parents = Path(__file__).resolve().parents
if len(_parents) > 3:
    load_dotenv(_parents[3] / ".env")


def _flag(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v in (None, "") else v.lower() in ("1", "true")


API_URL = os.getenv("API_URL", "http://localhost:3001")
MOCK_LLM = _flag("MOCK_LLM", True) or not os.getenv("ANTHROPIC_API_KEY")
MOCK_INVENTORY_PAYMENT = _flag("MOCK_INVENTORY_PAYMENT", False)
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "8"))
FX_COP_PER_USD = float(os.getenv("FX_COP_PER_USD", "4000"))
# Credencial única del servicio de agentes ante la api; cada agente es una fila (tabla agents) y se indica con
# x-agent-id. Dar de alta un agente no añade variables de entorno.
AGENT_SERVICE_KEY = os.getenv("AGENT_SERVICE_KEY", "dev-agents-key")
AGENT_ID = "asistente"

SMS_MAX = 160
