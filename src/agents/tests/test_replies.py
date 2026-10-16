"""Recorte de respuestas SMS: nunca a mitad de palabra ni con "…" (regresión del corte en producción)."""

import asyncio
from types import SimpleNamespace

import pytest

from assistant import replies, router, session
from common.config import SMS_MAX

# Respuesta real del modelo en producción; salió como "…yo lo bu…".
PROD = ("Hola. Yo le ayudo a comprar medicinas, mercado o efectivo en tiendas cercanas, con el presupuesto que "
        "Juan le dejó. Usted me escribe lo que necesita y yo lo busco, le digo el precio y usted decide si lo "
        "compra. Si es una compra grande le pido su PIN antes de pagar. Nada se paga sin que usted lo apruebe. "
        "Cuando quiera algo, solo escríbame por aquí.")


def test_el_tope_es_de_dos_segmentos_gsm():
    assert SMS_MAX == 306


def test_respuesta_corta_intacta():
    assert replies.clip("Hola. ¿Qué necesita?") == "Hola. ¿Qué necesita?"


def test_respuesta_de_produccion_se_corta_en_una_frase():
    assert len(PROD) > SMS_MAX
    out = replies.clip(PROD)
    assert len(out) <= SMS_MAX
    assert out.endswith("usted lo apruebe.") and "…" not in out
    assert PROD.startswith(out)


def test_con_tope_de_un_sms_tampoco_corta_palabras():
    out = replies.clip(PROD, limit=160)
    assert out == "Hola. Yo le ayudo a comprar medicinas, mercado o efectivo en tiendas cercanas, con el presupuesto que Juan le dejó."


def test_sin_frase_completa_corta_en_una_palabra():
    out = replies.clip("palabra " * 60)
    assert len(out) <= SMS_MAX and "…" not in out
    assert all(w == "palabra" for w in out.split())


def test_respuesta_larga_de_reglas_respeta_el_tope():
    motivo = "El comercio no respondió a tiempo. " * 12
    out = replies.purchase({"estado": "denegado", "motivo": motivo})
    assert len(out) <= SMS_MAX and "…" not in out
    assert out.endswith("a tiempo.")


class FakeClient:
    """Imita client.beta.messages.create con una sola respuesta de texto."""

    def __init__(self, text):
        async def create(**kwargs):
            self.kwargs = kwargs
            return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=text)])
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=create))


@pytest.fixture
def llm(monkeypatch):
    from assistant import llm
    from test_assistant import FakeApi

    monkeypatch.setattr(router, "api", FakeApi())
    monkeypatch.setattr(router, "MOCK_LLM", False)
    session.reset_all()
    return llm


def test_respuesta_larga_del_llm_se_corta_en_una_frase(llm, monkeypatch):
    fake = FakeClient(PROD)
    monkeypatch.setattr(llm, "_client", fake)
    reply = asyncio.run(router.respond("+573001112233", "hola mijo, solo dígame para qué me sirve este servicio"))
    assert reply == replies.clip(PROD) and reply.endswith(".")
    assert f"máximo {SMS_MAX} caracteres" in fake.kwargs["system"]
