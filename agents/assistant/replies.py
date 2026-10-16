"""Textos SMS deterministas (≤160 caracteres, español simple)."""

from common.config import SMS_MAX


def clip(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= SMS_MAX else text[: SMS_MAX - 1] + "…"


def search_result(r: dict, consulta: str) -> str | None:
    if "error" in r:
        return clip(r["error"])
    if not r["opciones"]:
        return clip(f"No encontré \"{consulta[:40]}\". Escriba el nombre del producto, por ejemplo: losartán.")
    return None


def purchase(r: dict) -> str:
    estado = r.get("estado")
    if estado == "necesita_pin":
        return clip(f"{r['comercio']} tiene {r['producto']} a {r['precio']}. Responda con su PIN para pagar o NO para cancelar.")
    if estado == "pagado":
        return clip(f"Listo, pagado. Recoja {r['producto']} en {r['comercio']} con el código {r['codigo_retiro']}.")
    if estado == "sin_pendiente":
        return "No hay ninguna compra esperando PIN. ¿Qué necesita?"
    return clip(f"No se pudo pagar: {r.get('motivo') or r.get('error')}.")


def balance(r: dict) -> str:
    if r["estado"] == "revocado":
        return "Su asistente fue desactivado por Juan. Comuníquese con él."
    return clip(f"Le quedan {r['disponible']} disponibles este periodo.")


HELP = "Hola, soy su asistente. Escriba lo que necesita, por ejemplo: 'la pastilla de la presión' o 'cuánto me queda'."
CANCELLED = "Compra cancelada. ¿Necesita algo más?"
UNKNOWN_PHONE = "Este número no está registrado en OpenRoute."
