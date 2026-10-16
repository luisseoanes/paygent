"""Alternativa determinista (AG-04): la demo funciona igual con MOCK_LLM=1 o si el LLM falla/tarda."""

import re

from . import replies, tools
from .session import Session
from inventory.search import normalize

BALANCE = re.compile(r"\b(saldo|queda|cuanto tengo|disponible)\b")
GREETING = re.compile(r"^(hola|buenas|buenos dias|buenas tardes|ayuda|menu)\W*$")
DELIVERY_WORDS = re.compile(r"\b(envi\w*|domicilio|traig\w*|traer\w*|llev\w*|a la casa|a mi casa)\b")
PICKUP_WORDS = re.compile(r"\b(recog\w*|recojo|paso por|voy por)\b")


def delivery_mode(t: str) -> str | None:
    """Si la persona ya dijo cómo lo quiere, no le preguntamos."""
    if PICKUP_WORDS.search(t):
        return tools.PICKUP
    if DELIVERY_WORDS.search(t):
        return tools.DELIVERY
    return None


async def handle(s: Session, text: str) -> str:
    t = normalize(text)
    if GREETING.match(t):
        return replies.HELP
    if BALANCE.search(t):
        return replies.balance(await tools.consultar_saldo(s))

    found = await tools.buscar_producto(s, text)
    if msg := replies.search_result(found, text):
        return msg
    best = s.options[0]
    mode = delivery_mode(t) if tools.can_deliver(s, best) else tools.PICKUP
    if mode is None:
        s.awaiting = {"indice": 0}
        return replies.choose(best, tools.recipient(s))
    return replies.purchase(await tools.proponer_compra(s, 0, mode))
