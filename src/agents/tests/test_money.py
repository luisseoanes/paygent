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
