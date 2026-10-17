"""Textos SMS deterministas (≤ SMS_MAX caracteres, español simple)."""

import re

from common.config import SMS_MAX
from common.money import fmt_cop


SENTENCE_END = re.compile(r"[.!?](?=\s|$)")


def clip(text: str, limit: int = SMS_MAX) -> str:
    """Recorta al final de una frase (o, si no hay, de una palabra); nunca a mitad de palabra ni con "…"."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    head = text[: limit + 1]  # +1: deja ver si el corte cae justo antes de un espacio
    ends = [m.end() for m in SENTENCE_END.finditer(head) if m.end() <= limit]
    if ends:
        return head[: ends[-1]]
    cut = head.rfind(" ")
    return head[:cut].rstrip(",;:") if cut > 0 else text[:limit]


def search_result(r: dict, consulta: str) -> str | None:
    if "error" in r:
        return clip(r["error"])
    if not r["opciones"]:
        return clip(f"No encontré \"{consulta[:40]}\". Escriba el nombre del producto, por ejemplo: losartán.")
    return None


def web_result(r: dict, not_nearby: bool = False) -> str:
    """Las ofertas más baratas en internet, tantas como quepan en un SMS."""
    head = "No lo tienen en la vereda. " if not_nearby else ""
    if not r["ofertas"]:
        return clip(f"{head}Tampoco encontré {r['producto']} en tiendas en línea. Escríbalo de otra forma.")
    tail = ". Solo comparo precios: aún no compro en línea."
    located = any(o.get("distancia") for o in r["ofertas"])
    text = f"{head}{r['producto']} {'cerca de usted' if located else 'en internet'}:"
    for i, o in enumerate(r["ofertas"]):
        where = f" a {o['distancia']}" if o.get("distancia") else (" en línea" if located else "")
        part = f"{',' if i else ''} {o['tienda']}{where} {o['precio']}"
        if len(text + part + tail) > SMS_MAX:
            break
        text += part
    return clip(text + tail)


def choose(o: dict, recipient: str) -> str:
    return clip(f"{o['merchant']} tiene {o['product']} a {fmt_cop(o['priceCOP'])}. Responda 1 para recogerlo "
                f"o 2 para enviarlo a casa de {recipient} (+{fmt_cop(o['deliveryFeeCOP'])}).")


def purchase(r: dict) -> str:
    estado = r.get("estado")
    delivery = r.get("entrega") == "domicilio"
    if estado == "necesita_pin":
        where = f"con envío a casa de {r['recibe']}" if delivery else "para recoger"
        return clip(f"{r['comercio']}: {r['producto']} a {r['precio']} {where}. Responda con su PIN para pagar o NO para cancelar.")
    if estado == "pagado" and delivery:
        return clip(f"Listo, pagado. {r['comercio']} lleva {r['producto']} a casa de {r['recibe']}. Al recibir, dé el código {r['codigo']}.")
    if estado == "pagado":
        return clip(f"Listo, pagado. Recoja {r['producto']} en {r['comercio']} con el código {r['codigo']}.")
    if estado == "sin_pendiente":
        return "No hay ninguna compra esperando PIN. ¿Qué necesita?"
    return clip(f"No se pudo pagar: {r.get('motivo') or r.get('error')}.")


REVOKED = "Su asistente está desactivado. Hable con quien le dio el permiso."
FROZEN = "Sus compras están en pausa. Hable con quien le dio el permiso."


def balance(r: dict) -> str:
    if r["estado"] == "revocado":
        return REVOKED
    if r.get("disponible_total") and r["disponible_total"] != r["disponible"]:
        return clip(f"Le quedan {r['disponible_total']} este periodo. Por este medio puede gastar hasta {r['disponible']}.")
    return clip(f"Le quedan {r['disponible']} disponibles este periodo.")


HELP = "Hola, soy su asistente. Escriba lo que necesita, por ejemplo: 'la pastilla de la presión' o 'cuánto me queda'."
CANCELLED = "Compra cancelada. ¿Necesita algo más?"
UNKNOWN_PHONE = "Este número no está registrado en Paygent."
