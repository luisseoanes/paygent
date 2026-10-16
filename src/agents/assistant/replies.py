"""Textos SMS deterministas (≤160 caracteres, español simple)."""

from common.config import SMS_MAX
from common.money import fmt_cop


def clip(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= SMS_MAX else text[: SMS_MAX - 1] + "…"


def search_result(r: dict, consulta: str) -> str | None:
    if "error" in r:
        return clip(r["error"])
    if not r["opciones"]:
        return clip(f"No encontré \"{consulta[:40]}\". Escriba el nombre del producto, por ejemplo: losartán.")
    return None


def web_result(r: dict, not_nearby: bool = False) -> str:
    """Las ofertas más baratas en internet, tantas como quepan en un SMS."""
    head = "No lo hay cerca. " if not_nearby else ""
    if not r["ofertas"]:
        return clip(f"{head}Tampoco encontré {r['producto']} en tiendas en línea. Escríbalo de otra forma.")
    tail = ". Solo comparo precios: aún no compro en línea."
    text = f"{head}{r['producto']} en internet:"
    for i, o in enumerate(r["ofertas"]):
        part = f"{',' if i else ''} {o['tienda']} {o['precio']}"
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


def balance(r: dict) -> str:
    if r["estado"] == "revocado":
        return "Su asistente fue desactivado por Juan. Comuníquese con él."
    return clip(f"Le quedan {r['disponible']} disponibles este periodo.")


HELP = "Hola, soy su asistente. Escriba lo que necesita, por ejemplo: 'la pastilla de la presión' o 'cuánto me queda'."
CANCELLED = "Compra cancelada. ¿Necesita algo más?"
UNKNOWN_PHONE = "Este número no está registrado en Paygent."
