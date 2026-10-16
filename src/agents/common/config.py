"""Configuración compartida. Lee el mismo .env de la raíz que usa la api."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


def _flag(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v in (None, "") else v.lower() in ("1", "true")


API_URL = os.getenv("API_URL", "http://localhost:3001")
MOCK_LLM = _flag("MOCK_LLM", True) or not os.getenv("ANTHROPIC_API_KEY")
MOCK_INVENTORY_PAYMENT = _flag("MOCK_INVENTORY_PAYMENT", False)
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "8"))
FX_COP_PER_USD = float(os.getenv("FX_COP_PER_USD", "4000"))
AGENT_KEY_ASSISTANT = os.getenv("AGENT_KEY_ASSISTANT", "dev-assistant-key")
WALLET_INVENTARIO = os.getenv("WALLET_INVENTARIO", "https://ilp.interledger-test.dev/agente-inventario")

SMS_MAX = 160
