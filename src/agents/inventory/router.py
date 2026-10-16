"""POST /inventory/query — cobra un micropago real por consulta (INV-03)."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from common.api_client import api
from common.config import MOCK_INVENTORY_PAYMENT, WALLET_INVENTARIO

from .search import search

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
    TODO INV-03 (BE): verificar además el incoming payment directamente en la wallet de Inventario."""
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
