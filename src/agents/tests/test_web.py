"""Búsqueda en internet (inventory/web.py) sin red: las tiendas se simulan con respuestas VTEX reales recortadas.
La prueba en vivo es:  uv run python -m inventory.web "pastilla de la presión" """

import asyncio

import httpx
import pytest

from inventory import web


def vtex(name, price, category, qty=10, link="https://tienda.example/p"):
    return {"productName": name, "brand": "X", "link": link, "categories": [category],
            "items": [{"sellers": [{"commertialOffer": {"Price": price, "AvailableQuantity": qty, "IsAvailable": qty > 0}}]}]}


CATALOGS = {
    "Pasteur": {"losartan": [vtex("LOSARTAN MEMPHIS TABLETAS 50 MG", 7992, "/Salud y medicamentos/Medicamentos/")],
                "arroz": [vtex("OLE SHAMPOO REVITALIZANTE DE ARROZ", 41531, "/Cuidado personal/Shampoo/"),
                          vtex("CHOCOLATINA JET CON ARROZ", 4799, "/Hogar/Otros alimentos/Confiteria/")]},
    "La Rebaja": {"losartan": [vtex("LOSARTAN POTASICO 100 MG (LA SANTE)", 9000, "/DROGUERIA/MEDICAMENTOS/"),
                               vtex("LOSARTAN POTASICO 50 MG (GENFAR)", 14100, "/DROGUERIA/MEDICAMENTOS/")]},
    "Olímpica": {"losartan": [vtex("LOSARTAN 50MG X 30 TAB", 14500, "/Medicamentos/Formulados/", qty=0)],
                 "arroz": [vtex("Arroz Mi Arroz 454 G", 1300, "/Mercado/Despensa/Granos y arroz/")]},
    "Éxito": {"arroz": [vtex("Minichefs Modelo Arroz MULTITECH", 39990, "/Hogar y decoración/Ollas/"),
                        vtex("Arroz SONORA blanco (1000 gr)", 3240, "/Mercado/Despensa/Granos y arroz/")]},
}


@pytest.fixture(autouse=True)
def fake_stores(monkeypatch):
    web._cache.clear()
    base_to_store = {url: name for name, url in web.STORES}

    async def fetch(client, base_url, term):
        store = base_to_store[base_url]
        if store == "Carulla":
            raise httpx.ConnectTimeout("sin respuesta")
        return CATALOGS.get(store, {}).get(term, [])

    monkeypatch.setattr(web, "_fetch_store", fetch)


def run(query, limit=10):
    return asyncio.run(web.search_web(query, limit=limit))


def test_entiende_frases_coloquiales():
    assert web.understand("necesito la pastilla de la presión") == \
        {"term": "losartan", "category": "farmacia", "label": "Losartán", "strength": "50 mg"}
    assert web.understand("pastila de la presion")["term"] == "losartan"  # con errores de ortografía
    assert web.understand("me duele la cabeza")["term"] == "acetaminofen"
    assert web.understand("una libra de arroz")["category"] == "mercado"
    # "tensiómetro" contiene "tensión", pero no es la pastilla de la presión: se busca tal cual
    assert web.understand("tensiometro digital") == \
        {"term": "tensiometro digital", "category": None, "label": "Tensiometro digital", "strength": None}


def test_losartan_ordena_por_presentacion_y_precio_y_descarta_agotados():
    r = run("necesito la pastilla de la presión")
    assert [(o["store"], o["priceCOP"]) for o in r["offers"]] == [("Pasteur", 7992), ("La Rebaja", 14100)]
    # La Rebaja tiene uno de 100 mg más barato, pero se pidió el de 50 mg; Olímpica está agotado
    assert "50 MG" in r["offers"][1]["product"]
    assert r["offers"][0]["url"].startswith("https://")


def test_arroz_descarta_ollas_champu_y_golosinas():
    r = run("una libra de arroz")
    assert [o["product"] for o in r["offers"]] == ["Arroz Mi Arroz 454 G", "Arroz SONORA blanco (1000 gr)"]


def test_una_tienda_caida_no_tumba_la_busqueda():
    r = run("losartan")
    assert r["storesFailed"] == ["Carulla"] and r["storesConsulted"] == len(web.STORES) - 1
    assert r["offers"]


def test_sin_resultados_no_se_guarda_en_cache():
    r = run("tensiometro digital")
    assert r["offers"] == [] and not web._cache


def test_una_tienda_lenta_se_omite_sin_frenar_la_busqueda(monkeypatch):
    """Una tienda que no termina de responder no puede dejar sin respuesta el SMS."""
    monkeypatch.setattr(web, "STORE_DEADLINE_S", 0.2)
    real = web._fetch_store

    async def slow(client, base_url, term):
        if "olimpica" in base_url:
            await asyncio.sleep(5)
        return await real(client, base_url, term)

    monkeypatch.setattr(web, "_fetch_store", slow)
    r = run("losartan")
    assert "Olímpica" in r["storesFailed"] and r["offers"]
