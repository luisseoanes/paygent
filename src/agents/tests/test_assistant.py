"""Flujo completo del Asistente con reglas (MOCK_LLM) y una api falsa que imita al gateway."""

import asyncio

import pytest

from assistant import router, session, tools
from common.config import SMS_MAX
from inventory import router as inventory_router

PHONE = "+573001112233"
PROFILE = {"phone": PHONE, "name": "Doña Carmen", "mandateId": "asistente", "dataMandateId": "asistente-datos",
           "location": {"lat": 6.0, "lng": -75.43}, "rootId": "root",
           "deliveryAddress": {"recipientName": "María", "address": "Vereda La Palma, casa 12"}}


class FakeApi:
    """Umbral de PIN de $10 y PIN 1234, como las semillas de la api."""

    def __init__(self):
        self.calls = []
        self.profile_data = dict(PROFILE)

    async def profile(self, phone):
        return self.profile_data if phone == PHONE else None

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
        if cents > 1000:
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


def test_pastilla_de_la_presion_pregunta_recoger_o_enviar(fake):
    reply = say("necesito la pastilla de la presión")
    assert "Farmacia San José" in reply and "1 para recogerlo" in reply and "casa de María" in reply
    assert len(reply) <= SMS_MAX
    # Hasta ahora solo el micropago agente → agente al Inventario: la compra espera la elección.
    assert len(fake.calls) == 1
    assert fake.calls[0]["category"] == "datos" and fake.calls[0]["amount"]["value"] == "1"


def test_domicilio_suma_el_envio_y_paga_sin_pin(fake):
    say("necesito la pastilla de la presión")
    reply = say("2")
    assert "lleva" in reply and "casa de María" in reply and "código" in reply and "PIN" not in reply
    compra = fake.calls[-1]
    # $12.000 + $4.000 de envío = $16.000 COP = $4.00, en un solo pago a la tienda
    assert compra["amount"]["value"] == "400"
    assert compra["delivery"]["mode"] == "delivery" and compra["delivery"]["fee"]["value"] == "100"
    # La dirección NUNCA la manda el agente: la pone el gateway con lo que registró Juan.
    assert "address" not in compra["delivery"]


def test_recoger_paga_solo_el_producto(fake):
    say("necesito la pastilla de la presión")
    reply = say("1")
    assert "Recoja" in reply and "código" in reply
    assert fake.calls[-1]["amount"]["value"] == "300" and fake.calls[-1]["delivery"]["mode"] == "pickup"


def test_si_ya_dijo_que_se_la_traigan_no_pregunta(fake):
    reply = say("tráigame la insulina")
    assert "Insulina" in reply and "con envío a casa de María" in reply and "PIN" in reply
    assert "incorrecto" in say("0000")
    reply = say("1234")
    assert "lleva" in reply and "código" in reply
    assert "1234" not in reply


def test_insulina_para_recoger_pide_pin(fake):
    reply = say("necesito la insulina, yo la recojo")
    assert "para recoger" in reply and "PIN" in reply and len(reply) <= SMS_MAX
    assert "Recoja" in say("1234")


def test_sin_direccion_registrada_solo_recoger(fake):
    fake.profile_data = {**PROFILE, "deliveryAddress": None}
    reply = say("necesito la pastilla de la presión")
    assert "Recoja" in reply and "casa" not in reply


@pytest.fixture
def fake_web(monkeypatch):
    async def search_web(query, limit=3):
        offers = [{"store": "Pasteur", "priceCOP": 7992, "product": "LOSARTAN 50 MG", "url": "https://x/p"},
                  {"store": "La Rebaja", "priceCOP": 14100, "product": "LOSARTAN 50 MG", "url": "https://y/p"}]
        known = "presion" in query or "losartan" in query
        return {"label": "Losartán" if known else query, "strength": "50 mg" if known else None,
                "offers": offers[:limit] if known else [], "storesConsulted": 7}

    monkeypatch.setattr(tools.web, "search_web", search_web)


def test_busca_en_internet_y_no_paga_nada(fake, fake_web):
    reply = say("busque en internet la pastilla de la presión")
    assert "Losartán 50 mg en internet: Pasteur $7.992, La Rebaja $14.100" in reply
    assert "aún no compro en línea" in reply and len(reply) <= SMS_MAX
    assert fake.calls == []  # ni la compra ni la consulta al Inventario local: solo informa


def test_si_no_esta_cerca_lo_busca_en_internet(fake, fake_web):
    reply = say("necesito un tensiometro")
    assert reply.startswith("No lo hay cerca.") and "Tampoco encontré" in reply
    assert all(c["category"] == "datos" for c in fake.calls)  # solo la consulta local de $0.01


def test_saldo():
    assert "Le quedan" in say("cuánto me queda?")


def test_cancelar():
    say("insulina")
    assert "cancelada" in say("no")


def test_numero_desconocido():
    assert "no está registrado" in asyncio.run(router.respond("+570000", "hola"))
