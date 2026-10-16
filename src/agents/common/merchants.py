"""Wallets de cobro de los comercios y del Agente de Inventario.

Viven en la base de la api (tabla merchants, GET /merchants), no en variables de entorno: dar de alta un comercio no
obliga a tocar el despliegue. Se cachean un minuto. Sin api (tests, arranque) se usa una dirección por defecto.
"""

import time

from .api_client import api

INVENTORY_ID = "inventario"
TTL_S = 60
_DEFAULT = "https://ilp.interledger-test.dev/{id}"

_wallets: dict[str, str] = {}
_loaded_at = 0.0


async def refresh(force: bool = False) -> None:
    global _loaded_at
    if _wallets and not force and time.monotonic() - _loaded_at < TTL_S:
        return
    try:
        for m in await api.merchants():
            _wallets[m["id"]] = m["wallet"]
        _loaded_at = time.monotonic()
    except Exception:  # noqa: BLE001 — sin api se sigue con lo que haya
        pass


def wallet_of(merchant_id: str) -> str:
    """Dirección de cobro del comercio. "puntored:<id>" = sin wallet; la api decide a dónde va el dinero."""
    if merchant_id.startswith("puntored:"):
        return merchant_id
    return _wallets.get(merchant_id, _DEFAULT.format(id=merchant_id))
