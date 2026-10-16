"""Flujo completo del Asistente con reglas (MOCK_LLM) y una api falsa que imita al gateway."""

import asyncio

import pytest

from assistant import router, session, tools
from common.config import SMS_MAX
from inventory import router as inventory_router

PHONE = "+573001112233"
PROFILE = {"phone": PHONE, "name": "Doña Carmen", "mandateId": "asistente", "dataMandateId": "asistente-datos",
           "location": {"lat": 6.0, "lng": -75.43}}


class FakeApi:
    """Umbral de PIN de $2 y PIN 1234, como las semillas de la api."""

    def __init__(self):
        self.calls = []

    async def profile(self, phone):
        return PROFILE if phone == PHONE else None

    async def mandate(self, mandate_id):
        return {"remaining": {"value": "2500", "assetCode": "USD", "assetScale": 2}, "revoked": False}

    async def payment(self, payment_id):
        return None

    async def pay(self, **body):
        self.calls.append(body)
        cents = int(body["amount"]["value"])
        if body.get("pendingId"):
            return {"result": "allow", "paymentId": "p2"} if body["pin"] == "1234" else \
                {"result": "deny", "reason": "bad_pin", "detail": "PIN incorrecto (1/3)"}
        if cents > 200:
            return {"result": "needs_pin", "pendingId": "pend1"}
        return {"result": "allow", "paymentId": "p1"}


@pytest.fixture(autouse=True)
def fake(monkeypatch):
    api = FakeApi()
    for mod in (router, tools):
        monkeypatch.setattr(mod, "api", api)
    monkeypatch.setattr(router, "MOCK_LLM", True)
    monkeypatch.setattr(inventory_router, "MOCK_INVENTORY_PAYMENT", True)
    session.reset_all()
    return api


def say(text):
    return asyncio.run(router.respond(PHONE, text))


def test_pastilla_de_la_presion_pide_pin_y_paga(fake):
    reply = say("necesito la pastilla de la presión")
    assert "Farmacia San José" in reply and "PIN" in reply and len(reply) <= SMS_MAX
    # 1ª llamada: micropago agente → agente al Inventario
    assert fake.calls[0]["category"] == "datos" and fake.calls[0]["amount"]["value"] == "1"

    assert "incorrecto" in say("0000")
    reply = say("1234")
    assert "código" in reply
    assert "1234" not in reply


def test_saldo():
    assert "Le quedan" in say("cuánto me queda?")


def test_cancelar():
    say("losartan")
    assert "cancelada" in say("no")


def test_numero_desconocido():
    assert "no está registrado" in asyncio.run(router.respond("+570000", "hola"))
