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
        assert asyncio.run(fx.refresh(Api({"copPerUsd": 3170.46, "fecha": "2026-10-16", "fuente": "trm"}))) is True
        assert asyncio.run(fx.refresh(Api(RuntimeError("sin api")))) is False
        assert fx.rate() == 3170.46
    finally:
        fx.set_rate(antes)


def test_si_la_api_no_responde_reintenta_pronto_y_luego_cada_hora():
    """Al arrancar antes que la api, los agentes no deben quedarse una hora con la tasa de respaldo."""
    from common import fx

    respuestas = [RuntimeError("api aún no arranca"), {"copPerUsd": 3170.46}]
    esperas = []

    class Api:
        async def fx(self):
            r = respuestas.pop(0)
            if isinstance(r, Exception):
                raise r
            return r

    async def dormir(segundos):
        esperas.append(segundos)
        if len(esperas) == 2:
            raise asyncio.CancelledError

    antes = fx.rate()
    try:
        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(fx.asyncio, "sleep", dormir)
            with pytest.raises(asyncio.CancelledError):
                asyncio.run(fx.keep_fresh(Api()))
        assert esperas == [60, 3600] and fx.rate() == 3170.46
    finally:
        fx.set_rate(antes)
