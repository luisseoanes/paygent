from datetime import datetime, timedelta, timezone

from common.money import COP, of

USD = {"assetCode": "USD", "assetScale": 2}


def cop(pesos):
    return of(COP, pesos)
from guardian.rules import evaluate, score

NOW = datetime(2026, 10, 15, 12, tzinfo=timezone.utc)
TIENDA = "https://ilp.interledger-test.dev/dona-rosa"


def v(i, minutes_ago=0, amount=20_000, merchant=TIENDA):
    return {"voucherId": f"v{i}", "deviceKeyId": "d1", "deviceCert": {"mandateId": "maria-device"},
            "merchantWallet": merchant, "amount": cop(amount),
            "createdAt": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def test_vale_normal_se_aprueba():
    assert evaluate([v(1)], [], NOW)[0]["action"] == "approve"


def test_velocidad():
    batch = [v(i, minutes_ago=i) for i in range(4)]
    assert evaluate(batch, [], NOW)[0]["rule"] == "velocidad"


def test_vale_antiguo():
    assert evaluate([v(1, minutes_ago=60 * 80)], [], NOW)[0]["rule"] == "vale_antiguo"


def test_comercio_nuevo_monto_alto():
    d = evaluate([v(1, amount=72_000, merchant="https://otro")], [], NOW)[0]
    assert d["rule"] == "comercio_nuevo_monto_alto"


def test_dos_reglas_congelan():
    d = evaluate([v(1, minutes_ago=60 * 80, amount=72_000, merchant="https://otro")], [], NOW)[0]
    assert d["action"] == "freeze"


def test_score_sube_dentro_del_techo():
    r = score("maria-device", "María", cop(80_000), cop(200_000), False, [])
    assert r["newCap"] == cop(130_000)  # +25 % del techo
    r = score("maria-device", "María", cop(180_000), cop(200_000), False, [])
    assert r["newCap"] == cop(200_000)  # nunca supera el techo de Juan


def test_score_baja_con_alertas():
    r = score("maria-device", "María", cop(80_000), cop(200_000), False, [{"status": "rejected"}])
    assert r["newCap"] == cop(40_000)
    r = score("maria-device", "María", cop(30_000), cop(200_000), False, [{"status": "rejected"}])
    assert r["newCap"] == cop(20_000)  # nunca por debajo del 10 % del techo


def test_score_proporcional_al_techo():
    # Un beneficiario nuevo: techo 50.000, arranca en 40 % (20.000) y necesita 3 vales limpios
    assert score("b1-cel", "Ana", cop(20_000), cop(50_000), False, [])["newCap"] == cop(20_000)
    limpio = [{"status": "settled"}] * 3
    assert score("b1-cel", "Ana", cop(20_000), cop(50_000), False, limpio)["newCap"] == cop(32_500)


def test_score_en_la_moneda_del_tope():
    r = score("maria-device", "María", of(USD, 20), of(USD, 50), False, [])
    assert r["newCap"] == of(USD, 32.5)


def test_tienda_de_siempre_con_su_direccion_actual_no_es_comercio_nuevo(monkeypatch):
    """Regresión: las direcciones conocidas eran URLs viejas; un vale alto en Doña Rosa salía como "comercio nuevo"."""
    import asyncio

    from common import merchants
    from guardian import router

    async def no_api(force=False):
        merchants._wallets.update({"tienda": "puntored:tienda", "farmacia": "https://ilp.interledger-test.dev/farmacia-san-jose-wallet"})

    monkeypatch.setattr(merchants, "refresh", no_api)
    now = datetime.now(timezone.utc)
    vale = lambda merchant: {"voucherId": "v1", "deviceKeyId": "d1", "deviceCert": {"mandateId": "maria-device"},  # noqa: E731
                             "merchantWallet": merchant, "amount": cop(72_000), "createdAt": now.isoformat()}
    body = lambda merchant: router.EvaluateIn(vouchers=[vale(merchant)], history=[])  # noqa: E731
    assert asyncio.run(router.evaluate(body("puntored:tienda")))["decisions"][0]["action"] == "approve"
    assert asyncio.run(router.evaluate(body("https://otra-tienda")))["decisions"][0]["rule"] == "comercio_nuevo_monto_alto"
