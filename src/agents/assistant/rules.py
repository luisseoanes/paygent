"""Alternativa determinista (AG-04): la demo funciona igual con MOCK_LLM=1 o si el LLM falla/tarda."""

import re

from . import replies, tools
from .session import Session
from inventory.search import normalize

BALANCE = re.compile(r"\b(saldo|queda|cuanto tengo|disponible)\b")
GREETING = re.compile(r"^(hola|buenas|buenos dias|buenas tardes|ayuda|menu)\W*$")


async def handle(s: Session, text: str) -> str:
    t = normalize(text)
    if GREETING.match(t):
        return replies.HELP
    if BALANCE.search(t):
        return replies.balance(await tools.consultar_saldo(s))

    found = await tools.buscar_producto(s, text)
    if msg := replies.search_result(found, text):
        return msg
    return replies.purchase(await tools.proponer_compra(s, 0))
