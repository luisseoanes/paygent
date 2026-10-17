import asyncio

import pytest

from common.money import COP, from_cop, of, to_cop

USD = {"assetCode": "USD", "assetScale": 2}


def test_en_cop_no_hay_conversion():
    assert from_cop(12_000, COP) == of(COP, 12_000) == {"value": "1200000", "assetCode": "COP", "assetScale": 2}
    assert to_cop(of(COP, 12_000)) == 12_000


def test_en_usd_convierte_con_la_tasa_de_referencia():
    assert from_cop(12_000, USD, rate=4000) == of(USD, 3)
    assert to_cop(of(USD, 3), rate=4000) == 12_000


def test_moneda_sin_tasa_falla():
    with pytest.raises(ValueError, match="MXN"):
        from_cop(1000, {"assetCode": "MXN", "assetScale": 2})


def test_sin_tasa_explicita_usa_la_trm_vigente():
    from common import fx

    antes = fx.rate()
    try:
        fx.set_rate(3200)
        assert from_cop(16_000, USD) == of(USD, 5)
        assert to_cop(of(USD, 5)) == 16_000
    finally:
        fx.set_rate(antes)


def test_refresh_toma_la_tasa_de_la_api_y_sin_api_conserva_la_ultima():
    from common import fx

    class Api:
        def __init__(self, resp):
            self.resp = resp

        async def fx(self):
            if isinstance(self.resp, Exception):
                raise self.resp
            return self.resp

    antes = fx.rate()
    try:
        assert asyncio.run(fx.refresh(Api({"copPerUsd": 3170.46, "fecha": "2026-10-16", "fuente": "trm"}))) == 3170.46
        assert asyncio.run(fx.refresh(Api(RuntimeError("sin api")))) == 3170.46
    finally:
        fx.set_rate(antes)
