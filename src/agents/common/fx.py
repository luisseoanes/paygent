"""Tasa COP por USD: la TRM del día que publica la api (GET /fx). Sin api, FX_COP_PER_USD."""

import asyncio
import logging

from .config import FX_COP_PER_USD

log = logging.getLogger(__name__)
_rate: float = FX_COP_PER_USD


def rate() -> float:
    return _rate


def set_rate(value: float) -> None:
    global _rate
    if value > 0:
        _rate = value


async def refresh(api) -> float:
    """Trae la tasa de la api; si falla, sigue con la última conocida."""
    try:
        set_rate(float((await api.fx())["copPerUsd"]))
    except Exception as e:  # noqa: BLE001 — sin api los agentes siguen con la tasa que tenían
        log.warning("Tasa no disponible (%s): sigo con %s", e, _rate)
    return _rate


async def keep_fresh(api, every_s: float = 3600) -> None:
    """La TRM cambia una vez al día: basta revisarla cada hora."""
    while True:
        await refresh(api)
        await asyncio.sleep(every_s)
