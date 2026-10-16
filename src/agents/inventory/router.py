"""POST /inventory/query — cobra un micropago real por consulta (INV-03)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from common.api_client import api
from common.config import MOCK_INVENTORY_PAYMENT, WALLET_INVENTARIO

from .search import search
from .web import search_web

router = APIRouter(prefix="/inventory", tags=["inventory"])

PRICE_PER_QUERY_COP = 40  # ≈ $0.01
_used_payments: set[str] = set()


class Location(BaseModel):
    lat: float
    lng: float


class QueryIn(BaseModel):
    query: str
    location: Location | None = None
    paymentId: str | None = None


async def verify_payment(payment_id: str | None) -> None:
    """Sin pago liquidado a la wallet del Agente de Inventario → 402.
    La api solo marca el pago `completed` cuando el incoming payment de la wallet de Inventario ya recibió
    lo cotizado (OP-06, src/api/src/op/settle.ts); si sigue en camino queda `pending` y aquí se rechaza."""
    if MOCK_INVENTORY_PAYMENT:
        return
    if not payment_id or payment_id in _used_payments:
        raise HTTPException(402, "Pago requerido: $0.01 por consulta")
    p = await api.payment(payment_id)
    if not p or p["status"] != "completed" or p["merchantWallet"] != WALLET_INVENTARIO:
        raise HTTPException(402, "El pago no está liquidado a la wallet del Agente de Inventario")
    _used_payments.add(payment_id)


async def query(q: QueryIn) -> dict:
    await verify_payment(q.paymentId)
    return {"options": search(q.query, q.location.model_dump() if q.location else None)}


@router.post("/query")
async def query_route(q: QueryIn):
    return await query(q)


class WebQueryIn(BaseModel):
    query: str
    limit: int = 5


@router.post("/web")
async def web_route(q: WebQueryIn):
    """Búsqueda real en tiendas en línea de Colombia (precio, disponibilidad y enlace). No compra ni paga."""
    return await search_web(q.query, limit=max(1, min(q.limit, 10)))
