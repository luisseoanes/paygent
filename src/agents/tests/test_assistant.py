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
    """Umbral de PIN de 40.000 COP y PIN 1234, como las semillas de la api."""

    def __init__(self):
        self.calls = []
        self.profile_data = dict(PROFILE)

    async def profile(self, phone):
        return self.profile_data if phone == PHONE else None

    async def root_asset(self):
        return {"assetCode": "COP", "assetScale": 2}

    async def mandate(self, mandate_id):
        return {"remaining": {"value": "10000000", "assetCode": "COP", "assetScale": 2}, "revoked": False}

    async def modes(self, mandate_id):
        """La persona tiene más que su Asistente: la billetera muestra el total."""
        return {"remaining": {"value": "50000000", "assetCode": "COP", "assetScale": 2}}

    async def payment(self, payment_id):
        return None

    async def pay(self, **body):
        self.calls.append(body)
        minor = int(body["amount"]["value"])
        if body.get("pendingId"):
            return {"result": "allow", "paymentId": "p2"} if body["pin"] == "1234" else \
                {"result": "deny", "reason": "bad_pin", "detail": "PIN incorrecto (1/3)"}
        if minor > 4_000_000:
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
    assert fake.calls[0]["category"] == "datos" and fake.calls[0]["amount"] == {"value": "4000", "assetCode": "COP", "assetScale": 2}  # 40 COP


def test_domicilio_suma_el_envio_y_paga_sin_pin(fake):
    say("necesito la pastilla de la presión")
    reply = say("2")
    assert "lleva" in reply and "casa de María" in reply and "código" in reply and "PIN" not in reply
    compra = fake.calls[-1]
    # $12.000 + $4.000 de envío = $16.000 COP, en un solo pago a la tienda y en la moneda del titular
    assert compra["amount"] == {"value": "1600000", "assetCode": "COP", "assetScale": 2}
    assert compra["delivery"]["mode"] == "delivery" and compra["delivery"]["fee"]["value"] == "400000"
    # La dirección NUNCA la manda el agente: la pone el gateway con lo que registró el titular.
    assert "address" not in compra["delivery"]


def test_recoger_paga_solo_el_producto(fake):
    say("necesito la pastilla de la presión")
    reply = say("1")
    assert "Recoja" in reply and "código" in reply
    assert fake.calls[-1]["amount"]["value"] == "1200000" and fake.calls[-1]["delivery"]["mode"] == "pickup"


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


def test_pin_de_seis_digitos_no_llega_al_llm(fake, monkeypatch):
    # Regresión: el router solo cogía 4 dígitos y la api acepta PIN de 4 a 6.
    monkeypatch.setattr(router, "MOCK_LLM", False)
    leaked = []

    async def handle(_s, text):
        leaked.append(text)
        return "llm"

    import assistant.llm as llm
    monkeypatch.setattr(llm, "handle", handle)
    session.get(PHONE, fake.profile_data).pending = {
        "pendingId": "pend1", "option": {"wallet": "w", "category": "farmacia", "product": "Insulina", "merchant": "F"},
        "entrega": tools.PICKUP, "codigo": "1", "total": 1000}
    say("123456")
    assert leaked == [] and fake.calls[-1]["pin"] == "123456"


def test_paga_en_la_moneda_del_arbol_de_quien_escribe(fake):
    # Cada titular tiene su moneda: la del perfil manda sobre la de la demo.
    fake.profile_data = {**PROFILE, "asset": {"assetCode": "USD", "assetScale": 2}}
    say("necesito la pastilla de la presión")
    assert fake.calls[0]["amount"]["assetCode"] == "USD"


def test_sin_direccion_registrada_solo_recoger(fake):
    fake.profile_data = {**PROFILE, "deliveryAddress": None}
    reply = say("necesito la pastilla de la presión")
    assert "Recoja" in reply and "casa" not in reply


@pytest.fixture
def fake_web(monkeypatch):
    async def search_web(query, limit=3, location=None):
        assert location == PROFILE["location"]  # busca cerca de quien escribe
        offers = [{"store": "La Rebaja", "priceCOP": 14100, "product": "LOSARTAN 50 MG", "url": "https://y/p",
                   "branch": {"name": "Drogas La Rebaja", "distanceM": 12_200}},
                  {"store": "Cafam", "priceCOP": 12950, "product": "LOSARTAN 50 MG", "url": "https://x/p", "branch": None}]
        known = "presion" in query or "losartan" in query
        return {"label": "Losartán" if known else query, "strength": "50 mg" if known else None,
                "offers": offers[:limit] if known else [], "storesConsulted": 7}

    monkeypatch.setattr(tools.web, "search_web", search_web)


def test_busca_en_internet_y_no_paga_nada(fake, fake_web):
    reply = say("busque en internet la pastilla de la presión")
    assert "Losartán 50 mg cerca de usted: La Rebaja a 12,2 km $14.100, Cafam en línea $12.950" in reply
    assert "aún no compro en línea" in reply and len(reply) <= SMS_MAX
    assert fake.calls == []  # ni la compra ni la consulta al Inventario local: solo informa


def test_si_no_esta_cerca_lo_busca_en_internet(fake, fake_web):
    reply = say("necesito un tensiometro")
    assert reply.startswith("No lo tienen en la vereda.") and "Tampoco encontré" in reply
    assert all(c["category"] == "datos" for c in fake.calls)  # solo la consulta local de $0.01


def test_saldo():
    reply = say("cuánto me queda?")
    # Lo mismo que muestra la billetera (todas sus formas de pagar) y lo que puede gastar por este medio.
    assert "Le quedan $500.000" in reply and "hasta $100.000" in reply


def test_saldo_sin_modos_da_lo_del_asistente(fake, monkeypatch):
    async def sin_modos(_):
        return None
    monkeypatch.setattr(fake, "modes", sin_modos)
    assert say("cuánto me queda?") == "Le quedan $100.000 disponibles este periodo."


def test_asistente_desactivado_no_nombra_a_nadie(fake, monkeypatch):
    async def revocado(_):
        return {"remaining": {"value": "0", "assetCode": "COP", "assetScale": 2}, "revoked": True}
    monkeypatch.setattr(fake, "mandate", revocado)
    assert say("saldo") == "Su asistente está desactivado. Hable con quien le dio el permiso."


def test_cancelar():
    say("insulina")
    assert "cancelada" in say("no")


def test_numero_desconocido():
    assert "no está registrado" in asyncio.run(router.respond("+570000", "hola"))


@pytest.mark.parametrize("estado, texto", [
    ({"revoked": True}, "Su asistente está desactivado. Hable con quien le dio el permiso."),
    ({"frozen": True}, "Sus compras están en pausa. Hable con quien le dio el permiso."),
])
def test_rama_revocada_o_pausada_avisa_de_entrada_sin_gastar(fake, monkeypatch, estado, texto):
    async def rama(_):
        return {"remaining": {"value": "0", "assetCode": "COP", "assetScale": 2}, "revoked": False, "frozen": False, **estado}
    monkeypatch.setattr(fake, "mandate", rama)
    assert say("necesito acetaminofén") == texto
    # Ni la consulta al Inventario se intenta: el gateway la negaría.
    assert fake.calls == []
