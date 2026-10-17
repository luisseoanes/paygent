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

# 4 a 6 dígitos, como los PIN que acepta la api: cualquiera de ellos se queda fuera del LLM ("1234", "PIN 1234"…).
PIN = re.compile(r"^\s*(?:(?:mi|el)\s+)?(?:pin|clave)?(?:\s+es)?\s*[:=]?\s*(\d{4,6})\s*[.!]*\s*$", re.I)
PIN_WORD = re.compile(r"\b(pin|clave)\b", re.I)
DIGITS = re.compile(r"\b\d{4,6}\b")


def sin_pin(s: session.Session, text: str) -> str:
    """Lo que ve el LLM: con una compra esperando PIN, o si se nombra el PIN, sus dígitos van tapados."""
    return DIGITS.sub("****", text) if s.pending or PIN_WORD.search(text) else text
CANCEL = re.compile(r"^\s*(no|cancelar|cancele)\W*$", re.I)
CHOOSE_PICKUP = re.compile(r"^\s*(1|recoger|recojo|lo recojo|yo lo recojo)\W*$", re.I)
CHOOSE_DELIVERY = re.compile(r"^\s*(2|enviar|env[ií]o|domicilio|a la casa|tr[aá]igan\w*)\W*$", re.I)


async def _rama(profile: dict) -> dict | None:
    """Estado de la rama con que paga el Asistente; si la api no responde, el gateway igual decide."""
    try:
        return await api.mandate(profile["mandateId"])
    except Exception:  # noqa: BLE001
        return None


class MessageIn(BaseModel):
    phone: str
    text: str


async def respond(phone: str, text: str) -> str:
    profile = await api.profile(phone)
    if not profile:
        return replies.UNKNOWN_PHONE
    s = session.get(phone, profile)
    s.mandato = await _rama(profile)
    # Rama revocada o pausada: se avisa de entrada, sin intentar consultas ni pagos que el gateway negaría.
    if s.mandato and s.mandato.get("revoked"):
        s.pending = s.awaiting = None
        return replies.REVOKED
    if s.mandato and s.mandato.get("frozen"):
        return replies.FROZEN

    # Humano en el bucle (AG-03): el PIN se maneja de forma determinista, nunca pasa por el LLM.
    if m := PIN.match(text):
        return replies.purchase(await tools.confirmar_pin(s, m.group(1)))
    if (s.pending or s.awaiting) and CANCEL.match(text):
        s.pending = s.awaiting = None
        return replies.CANCELLED

    # Respuesta a "1 recoger / 2 enviar a casa de quien recibe" (determinista, igual con o sin LLM).
    if s.awaiting:
        indice = s.awaiting["indice"]
        s.awaiting = None
        if CHOOSE_PICKUP.match(text):
            return replies.purchase(await tools.proponer_compra(s, indice, tools.PICKUP))
        if CHOOSE_DELIVERY.match(text):
            return replies.purchase(await tools.proponer_compra(s, indice, tools.DELIVERY))
        # cualquier otra cosa es una petición nueva

    if not MOCK_LLM:
        try:
            from . import llm  # import diferido: sin API key no se crea el cliente
            return await llm.handle(s, sin_pin(s, text))
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
