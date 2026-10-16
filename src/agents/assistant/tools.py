"""Las únicas acciones que puede hacer el Asistente. Las usan tanto el LLM como las reglas de respaldo.

Guardarraíl (AG-04): ningún pago ocurre fuera de estas funciones, y todas pasan por /pay del gateway,
que aplica topes, categorías y PIN. El modelo propone; el gateway decide.
"""

import random

from common.api_client import api
from common.config import WALLET_INVENTARIO
from common.money import fmt_cop, from_cop, to_cop
from inventory import web
from inventory.router import PRICE_PER_QUERY_COP, QueryIn, query

from .session import Session

PICKUP, DELIVERY = "recoger", "domicilio"


def recipient(s: Session) -> str | None:
    """Quién recibe los domicilios. Lo registró Juan; el agente no puede cambiarlo."""
    return (s.profile.get("deliveryAddress") or {}).get("recipientName")


def can_deliver(s: Session, o: dict) -> bool:
    return bool(o.get("deliveryFeeCOP")) and bool(recipient(s))


async def buscar_producto(s: Session, consulta: str) -> dict:
    """Paga 40 COP (≈ $0.01) al Agente de Inventario (agente → agente) y consulta quién tiene el producto."""
    pay = await api.pay(
        mandateId=s.profile["dataMandateId"], merchantWallet=WALLET_INVENTARIO,
        amount=from_cop(PRICE_PER_QUERY_COP, await api.root_asset()),
        category="datos", reason=f"Consulta de inventario: \"{consulta[:40]}\"",
    )
    if pay.get("result") != "allow":
        return {"error": f"No pude pagar la consulta: {pay.get('detail') or pay.get('reason')}"}
    result = await query(QueryIn(query=consulta, location=s.profile.get("location"), paymentId=pay["paymentId"]))
    s.options = result["options"]
    return {
        "opciones": [
            {"indice": i, "comercio": o["merchant"], "producto": o["product"], "precio": fmt_cop(o["priceCOP"]),
             "distancia_m": o["distanceM"],
             "envio": fmt_cop(o["deliveryFeeCOP"]) if can_deliver(s, o) else "no disponible"}
            for i, o in enumerate(s.options)
        ],
        "envio_a": f"casa de {recipient(s)}" if recipient(s) else "sin dirección registrada",
    }


async def buscar_en_internet(s: Session, consulta: str) -> dict:
    """Busca el producto de verdad en tiendas en línea de Colombia (precio, disponibilidad y enlace).
    Solo informa: NO compra ni paga. Comprar en línea todavía no está habilitado."""
    r = await web.search_web(consulta, limit=3)
    s.web_offers = r["offers"]
    return {
        "producto": f"{r['label']} {r['strength'] or ''}".strip(),
        "ofertas": [{"tienda": o["store"], "precio": fmt_cop(o["priceCOP"]), "producto": o["product"]}
                    for o in r["offers"]],
        "tiendas_consultadas": r["storesConsulted"],
        "nota": "Solo comparación de precios: todavía no se puede comprar en línea.",
    }


def _code() -> str:
    return f"{random.randint(1000, 9999)}"


def _info(s: Session, o: dict, entrega: str, total: int) -> dict:
    return {"comercio": o["merchant"], "producto": o["product"], "precio": fmt_cop(total), "entrega": entrega,
            "recibe": recipient(s)}


async def proponer_compra(s: Session, indice: int = 0, entrega: str = PICKUP) -> dict:
    """Paga la opción elegida, para recoger o con domicilio (producto + envío en un solo pago a la tienda).
    El total cuenta para el umbral de PIN: si lo supera, el gateway responde needs_pin."""
    if not s.options or not (0 <= indice < len(s.options)):
        return {"error": "Primero hay que buscar el producto"}
    o = s.options[indice]
    if entrega == DELIVERY and not can_deliver(s, o):
        return {"error": f"{o['merchant']} no hace domicilios" if recipient(s) else "Juan no ha registrado una dirección"}
    fee = o["deliveryFeeCOP"] if entrega == DELIVERY else 0
    total = o["priceCOP"] + fee
    code = _code()
    delivery = {"mode": "delivery" if entrega == DELIVERY else "pickup", "code": code}
    if fee:
        delivery["fee"] = from_cop(fee, await api.root_asset())
    where = f"con envío a casa de {recipient(s)}" if entrega == DELIVERY else "para recoger"
    pay = await api.pay(
        mandateId=s.profile["mandateId"], merchantWallet=o["wallet"], amount=from_cop(total, await api.root_asset()),
        category=o["category"], reason=f"{o['product']} en {o['merchant']} para {s.profile['name']}, {where}",
        delivery=delivery,
    )
    if pay["result"] == "needs_pin":
        s.pending = {"pendingId": pay["pendingId"], "option": o, "entrega": entrega, "codigo": code, "total": total}
        return {"estado": "necesita_pin", **_info(s, o, entrega, total)}
    if pay["result"] == "allow":
        return {"estado": "pagado", "codigo": code, **_info(s, o, entrega, total)}
    return {"estado": "rechazado", "motivo": pay.get("detail") or pay.get("reason")}


async def confirmar_pin(s: Session, pin: str) -> dict:
    """Determinista: el PIN NUNCA pasa por el LLM."""
    if not s.pending:
        return {"estado": "sin_pendiente"}
    p = s.pending
    o = p["option"]
    # El gateway usa lo que guardó en la compra pendiente (monto, comercio y entrega), no lo que mandemos aquí.
    pay = await api.pay(
        mandateId=s.profile["mandateId"], merchantWallet=o["wallet"], amount=from_cop(p["total"], await api.root_asset()),
        category=o["category"], reason=o["product"], pendingId=p["pendingId"], pin=pin,
    )
    if pay["result"] == "allow":
        s.pending = None
        return {"estado": "pagado", "codigo": p["codigo"], **_info(s, o, p["entrega"], p["total"])}
    if pay.get("reason") != "bad_pin" or "3/3" in (pay.get("detail") or ""):
        s.pending = None
    return {"estado": "rechazado", "motivo": pay.get("detail") or pay.get("reason")}


async def consultar_saldo(s: Session) -> dict:
    m = await api.mandate(s.profile["mandateId"])
    return {"disponible": fmt_cop(to_cop(m["remaining"])), "estado": "revocado" if m["revoked"] else "activo"}


TOOL_SCHEMAS = [
    {
        "name": "buscar_producto",
        "description": "Busca qué tienda cercana tiene un producto (medicamento, mercado o efectivo) y a qué precio. "
                       "Cuesta 40 pesos por consulta. Úsala cuando la persona pida algo para comprar.",
        "input_schema": {
            "type": "object",
            "properties": {"consulta": {"type": "string", "description": "Lo que pidió la persona, en sus palabras"}},
            "required": ["consulta"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "proponer_compra",
        "description": "Inicia el pago de una de las opciones de la última búsqueda, para recoger en el comercio "
                       "o con domicilio a la casa registrada por Juan (el envío se suma al precio). Si requiere PIN, "
                       "la persona debe responder con su PIN de 4 dígitos.",
        "input_schema": {
            "type": "object",
            "properties": {
                "indice": {"type": "integer", "description": "Índice de la opción (0 = la mejor)"},
                "entrega": {"type": "string", "enum": [PICKUP, DELIVERY],
                            "description": "recoger en el comercio o domicilio a la casa registrada"},
            },
            "required": ["indice", "entrega"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "buscar_en_internet",
        "description": "Busca el producto en tiendas en línea reales de Colombia (droguerías y supermercados) y "
                       "devuelve las más baratas con su precio. Solo informa: no compra ni paga. Úsala si la persona "
                       "pide buscar en internet o comparar precios, o si no está en las tiendas cercanas.",
        "input_schema": {
            "type": "object",
            "properties": {"consulta": {"type": "string", "description": "Lo que pidió la persona, en sus palabras"}},
            "required": ["consulta"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "consultar_saldo",
        "description": "Consulta cuánto le queda disponible a la persona en este periodo.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "strict": True,
    },
]


async def run_tool(s: Session, name: str, args: dict) -> dict:
    if name == "buscar_producto":
        return await buscar_producto(s, str(args.get("consulta", "")))
    if name == "proponer_compra":
        return await proponer_compra(s, int(args.get("indice", 0)), str(args.get("entrega", PICKUP)))
    if name == "buscar_en_internet":
        return await buscar_en_internet(s, str(args.get("consulta", "")))
    if name == "consultar_saldo":
        return await consultar_saldo(s)
    return {"error": f"Herramienta desconocida: {name}"}
