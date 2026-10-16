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
    assert r["newCap"] == cop(140_000)
    r = score("maria-device", "María", cop(180_000), cop(200_000), False, [])
    assert r["newCap"] == cop(200_000)  # nunca supera el techo de Juan


def test_score_baja_con_alertas():
    r = score("maria-device", "María", cop(80_000), cop(200_000), False, [{"status": "rejected"}])
    assert r["newCap"] == cop(40_000)


def test_score_en_la_moneda_del_tope():
    r = score("maria-device", "María", of(USD, 20), of(USD, 50), False, [])
    assert r["newCap"] == of(USD, 35)
