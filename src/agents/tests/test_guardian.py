from datetime import datetime, timedelta, timezone

from common.money import usd
from guardian.rules import evaluate, score

NOW = datetime(2026, 10, 15, 12, tzinfo=timezone.utc)
TIENDA = "https://ilp.interledger-test.dev/dona-rosa"


def v(i, minutes_ago=0, amount=5.0, merchant=TIENDA):
    return {"voucherId": f"v{i}", "deviceKeyId": "d1", "deviceCert": {"mandateId": "maria-device"},
            "merchantWallet": merchant, "amount": usd(amount),
            "createdAt": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def test_vale_normal_se_aprueba():
    assert evaluate([v(1)], [], NOW)[0]["action"] == "approve"


def test_velocidad():
    batch = [v(i, minutes_ago=i) for i in range(4)]
    assert evaluate(batch, [], NOW)[0]["rule"] == "velocidad"


def test_vale_antiguo():
    assert evaluate([v(1, minutes_ago=60 * 80)], [], NOW)[0]["rule"] == "vale_antiguo"


def test_comercio_nuevo_monto_alto():
    d = evaluate([v(1, amount=18, merchant="https://otro")], [], NOW)[0]
    assert d["rule"] == "comercio_nuevo_monto_alto"


def test_dos_reglas_congelan():
    d = evaluate([v(1, minutes_ago=60 * 80, amount=18, merchant="https://otro")], [], NOW)[0]
    assert d["action"] == "freeze"


def test_score_sube_dentro_del_techo():
    r = score("maria-device", "María", usd(20), usd(50), False, [])
    assert r["newCap"] == usd(35)
    r = score("maria-device", "María", usd(45), usd(50), False, [])
    assert r["newCap"] == usd(50)  # nunca supera el techo de Juan


def test_score_baja_con_alertas():
    r = score("maria-device", "María", usd(20), usd(50), False, [{"status": "rejected"}])
    assert r["newCap"] == usd(10)
