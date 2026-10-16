"""POST /assistant/message — entrada única del Asistente (SMS real o celular simulado)."""

import logging
import re

from fastapi import APIRouter
from pydantic import BaseModel

from common.api_client import api
from common.config import MOCK_LLM

from . import replies, rules, session, tools

router = APIRouter(prefix="/assistant", tags=["assistant"])
log = logging.getLogger("assistant")

PIN = re.compile(r"^\s*(\d{4})\s*$")
CANCEL = re.compile(r"^\s*(no|cancelar|cancele)\W*$", re.I)


class MessageIn(BaseModel):
    phone: str
    text: str


async def respond(phone: str, text: str) -> str:
    profile = await api.profile(phone)
    if not profile:
        return replies.UNKNOWN_PHONE
    s = session.get(phone, profile)

    # Humano en el bucle (AG-03): el PIN se maneja de forma determinista, nunca pasa por el LLM.
    if m := PIN.match(text):
        return replies.purchase(await tools.confirmar_pin(s, m.group(1)))
    if s.pending and CANCEL.match(text):
        s.pending = None
        return replies.CANCELLED

    if not MOCK_LLM:
        try:
            from . import llm  # import diferido: sin API key no se crea el cliente
            return await llm.handle(s, text)
        except Exception as err:  # timeout, red, rechazo… → reglas
            log.warning("LLM falló (%s); usando reglas", err)
            if s.pending:
                o = s.pending["option"]
                return replies.clip(f"{o['merchant']} tiene {o['product']}. Responda con su PIN para pagar o NO para cancelar.")
    return await rules.handle(s, text)


@router.post("/message")
async def message(body: MessageIn):
    return {"reply": await respond(body.phone, body.text)}


@router.post("/reset")
async def reset():
    session.reset_all()
    return {"ok": True}
