"""Búsqueda REAL en internet: catálogos públicos (VTEX) de droguerías y supermercados de Colombia.

Encuentra el producto en tiendas reales con su precio, disponibilidad y enlace, en vivo y sin llaves.
NO compra ni paga: solo informa. Comprar en una tienda en línea es un paso posterior.

    uv run python -m inventory.web "pastilla de la presión"     # prueba en vivo
"""

import asyncio
import logging
import re
import sys
import time

from urllib.parse import quote

import httpx

from .search import MIN_SCORE, OFFERS, match_score, normalize, strip_stopwords, whole_words

log = logging.getLogger("inventory.web")

# Tiendas con catálogo público VTEX que responden sin llave (verificado el 2026-10-16).
STORES = [
    ("Pasteur", "https://www.farmaciaspasteur.com.co"),
    ("La Rebaja", "https://www.larebajavirtual.com"),
    ("Locatel", "https://www.locatelcolombia.com"),
    ("Cafam", "https://www.drogueriascafam.com.co"),
    ("Olímpica", "https://www.olimpica.com"),
    ("Éxito", "https://www.exito.com"),
    ("Carulla", "https://www.carulla.com"),
]

# La categoría de la tienda separa "arroz" de una olla arrocera o un champú de arroz.
CATEGORY_HINTS = {
    "farmacia": ("medicament", "drogueria", "farmac", "salud"),
    "mercado": ("mercado", "despensa", "granos", "alimentos", "viveres", "abarrotes", "lacteos", "huevos",
                "endulzantes", "panaderia", "aceites"),
}

# Cada tienda responde 0,5-2 MB de JSON: pocas filas y un tope de tiempo TOTAL por tienda (el timeout de httpx
# es por lectura y no corta una descarga lenta). En Railway la búsqueda llegó a pasar de 30 s sin esto.
STORE_DEADLINE_S = 5
CACHE_TTL_S = 600
RESULTS_PER_STORE = 10
_cache: dict[str, tuple[float, dict]] = {}

STRENGTH = re.compile(r"(\d+)\s*mg\b")


def understand(query: str) -> dict:
    """Frase coloquial → qué buscar en las tiendas. Usa los sinónimos del catálogo local
    ("pastilla de la presión" → losartán 50 mg); si no lo conoce, busca las palabras tal cual."""
    scored = [(match_score(query, o), o) for o in OFFERS]
    score, best = max(scored, key=lambda x: x[0], default=(0, None))
    q = normalize(query)
    if best and score >= MIN_SCORE and whole_words(query, best):
        name = normalize(best.product)
        term = re.split(r"[\d(]", name)[0].strip()
        strength = STRENGTH.search(q) or STRENGTH.search(name)
        label = re.split(r"[\d(]", best.product)[0].strip()
        return {"term": term, "category": best.category, "label": label,
                "strength": f"{strength.group(1)} mg" if strength else None}
    term = strip_stopwords(query) or q
    strength = STRENGTH.search(q)
    return {"term": term, "category": None, "label": term.capitalize(),
            "strength": f"{strength.group(1)} mg" if strength else None}


async def _fetch_store(client: httpx.AsyncClient, base_url: str, term: str) -> list[dict]:
    # VTEX rechaza el espacio codificado como "+" (400): va como %20.
    r = await client.get(f"{base_url}/api/catalog_system/pub/products/search"
                         f"?ft={quote(term)}&_from=0&_to={RESULTS_PER_STORE - 1}")
    r.raise_for_status()
    return r.json()


def _relevant(product: dict, need: dict) -> dict | None:
    """Producto VTEX → oferta, o None si no es lo que se busca o no está disponible."""
    name = normalize(product.get("productName") or "")
    if not all(tok in name for tok in need["term"].split() if len(tok) >= 3):
        return None
    # En mercado el producto se llama por lo que es ("Arroz Diana"); un "Snack de arroz" o una
    # "Chocolatina con arroz" no son arroz. En droguería la marca suele ir primero ("Genfar Losartán").
    if need["category"] == "mercado" and not name.startswith(need["term"]):
        return None
    if need["category"]:
        path = normalize(" ".join(product.get("categories") or []))
        if not any(h in path for h in CATEGORY_HINTS[need["category"]]):
            return None
    for item in product.get("items") or []:
        for seller in item.get("sellers") or []:
            offer = seller.get("commertialOffer") or {}
            price = offer.get("Price") or 0
            if price > 0 and offer.get("AvailableQuantity", 0) > 0 and offer.get("IsAvailable", True):
                return {"product": product["productName"].strip(), "brand": product.get("brand"),
                        "priceCOP": round(price), "url": product.get("link")}
    return None


def _rank(offer: dict, need: dict) -> tuple:
    # Primero la presentación pedida (p. ej. 50 mg), luego el precio.
    same_strength = need["strength"] and need["strength"].replace(" ", "") in normalize(offer["product"]).replace(" ", "")
    return (0 if same_strength or not need["strength"] else 1, offer["priceCOP"])


async def search_web(query: str, limit: int = 3) -> dict:
    """Busca en las tiendas en paralelo. Devuelve la mejor oferta de cada tienda, ordenadas."""
    need = understand(query)
    key = f"{need['term']}|{need['category']}|{need['strength']}"
    if (hit := _cache.get(key)) and time.time() - hit[0] < CACHE_TTL_S:
        return {**hit[1], "offers": hit[1]["offers"][:limit], "cached": True}

    async with httpx.AsyncClient(timeout=STORE_DEADLINE_S, follow_redirects=True,
                                 headers={"User-Agent": "Mozilla/5.0 (Paygent agente de compras)"}) as client:
        results = await asyncio.gather(
            *(asyncio.wait_for(_fetch_store(client, url, need["term"]), STORE_DEADLINE_S) for _, url in STORES),
            return_exceptions=True)

    offers, failed = [], []
    for (store, _), res in zip(STORES, results):
        if isinstance(res, BaseException):
            log.warning("%s no respondió: %s", store, res)
            failed.append(store)
            continue
        candidates = [o for p in res if (o := _relevant(p, need))]
        if candidates:
            offers.append({"store": store, **min(candidates, key=lambda o: _rank(o, need))})
    offers.sort(key=lambda o: _rank(o, need))

    result = {"query": query, "term": need["term"], "label": need["label"], "strength": need["strength"],
              "category": need["category"], "offers": offers, "storesConsulted": len(STORES) - len(failed),
              "storesFailed": failed, "searchedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "cached": False}
    if offers:  # no guardamos fallos de red en la caché
        _cache[key] = (time.time(), result)
    return {**result, "offers": offers[:limit]}


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    r = asyncio.run(search_web(" ".join(sys.argv[1:]) or "pastilla de la presión", limit=10))
    print(f"Busqué \"{r['term']}\" ({r['category'] or 'sin categoría'}, {r['strength'] or 'cualquier presentación'}) "
          f"en {r['storesConsulted']} tiendas. Sin respuesta: {', '.join(r['storesFailed']) or 'ninguna'}")
    for o in r["offers"]:
        print(f"  {o['store']:<10} ${o['priceCOP']:>9,}  {o['product']}  {o['url']}".replace(",", "."))
