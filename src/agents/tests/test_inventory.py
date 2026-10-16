import pytest

from inventory.search import search

# INV-02: consultas coloquiales → producto esperado en el top 1. Amplíen esta lista (CA: 20 consultas).
CASES = [
    ("necesito la pastilla de la presión", "Losartán"),
    ("la pasta de la presion", "Losartán"),
    ("losartan", "Losartán"),
    ("pastila de la presion", "Losartán"),
    ("algo para el azucar", "Metformina"),
    ("me duele la cabeza", "Acetaminofén"),
    ("dolex", "Acetaminofén"),
    ("tengo gastritis", "Omeprazol"),
    ("una libra de arroz", "Arroz"),
    ("huevos", "Huevos"),
    ("panela", "Panela"),
    ("frisoles", "Fríjol"),
    ("algo para la alergia", "Loratadina"),
    ("colesterol", "Atorvastatina"),
]


@pytest.mark.parametrize("query,expected", CASES)
def test_top1(query, expected):
    results = search(query)
    assert results, f"sin resultados para {query!r}"
    assert results[0]["product"].startswith(expected)


def test_sin_stock_no_aparece():
    assert all(r["stock"] > 0 for r in search("losartan"))


def test_basura_no_devuelve_nada():
    assert search("xyzzy qwerty") == []
    assert search("no") == []


def test_comercio_sin_wallet_cobra_por_puntored():
    """Doña Rosa no tiene wallet: su dirección de cobro es puntored:tienda y la api le paga por Puntored."""
    rosa = [o for o in search("arroz", limit=10) if o["merchant"] == "Tienda Doña Rosa"]
    assert rosa and rosa[0]["wallet"] == "puntored:tienda"
    con_wallet = [o for o in search("arroz", limit=10) if o["merchant"] == "Minimercado El Paisa"]
    assert con_wallet and con_wallet[0]["wallet"].startswith("https://")
