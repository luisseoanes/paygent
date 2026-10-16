"""INV-02: sinónimos coloquiales + fuzzy matching (rapidfuzz) + ranking por precio, distancia y stock.

El catálogo es sintético (ver README de agents). Lo REAL es el pago por consultarlo.
"""

import csv
import math
import os
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from rapidfuzz import fuzz

HERE = Path(__file__).parent
MIN_SCORE = 70

STOPWORDS = {"necesito", "quiero", "la", "el", "los", "las", "de", "del", "una", "un", "me", "por", "favor",
             "para", "comprar", "mandeme", "mandame", "busco", "hay", "tiene", "tienen", "mi", "que", "se", "acabo"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c)).strip()


def strip_stopwords(text: str) -> str:
    return " ".join(w for w in normalize(text).split() if w not in STOPWORDS)


@dataclass
class Offer:
    merchant_id: str
    merchant: str
    wallet: str
    product: str
    category: str
    price_cop: int
    stock: int
    lat: float
    lng: float
    terms: list[str]
    delivery_fee_cop: int = 0  # 0 = el comercio no hace domicilios


def _load() -> list[Offer]:
    with open(HERE / "merchants.csv", encoding="utf-8") as f:
        merchants = {r["merchant_id"]: r for r in csv.DictReader(f)}
    offers = []
    with open(HERE / "catalog.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m = merchants[r["merchant_id"]]
            offers.append(Offer(
                merchant_id=r["merchant_id"], merchant=m["name"],
                # "puntored:<id>" = comercio sin wallet que cobra por Puntored (la api decide a dónde va el dinero)
                wallet=m["wallet_env"] if m["wallet_env"].startswith("puntored:")
                else os.getenv(m["wallet_env"], f"https://ilp.interledger-test.dev/{r['merchant_id']}"),
                product=r["product"], category=r["category"],
                price_cop=int(r["price_cop"]), stock=int(r["stock"]),
                lat=float(m["lat"]), lng=float(m["lng"]),
                terms=[normalize(r["product"])] + [normalize(s) for s in r["synonyms"].split("|")],
                delivery_fee_cop=int(m.get("delivery_fee_cop") or 0),
            ))
    return offers


OFFERS = _load()


def distance_m(a: dict, lat: float, lng: float) -> int:
    """Haversine en metros."""
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(lat)
    dp, dl = p2 - p1, math.radians(lng - a["lng"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(h)))


def match_score(query: str, offer: Offer) -> float:
    q = strip_stopwords(query) or normalize(query)
    if len(q) < 3:
        return 0
    return max(
        max(fuzz.token_set_ratio(q, t), fuzz.partial_ratio(t, q) if len(t) >= 4 and len(q) >= 4 else 0)
        for t in offer.terms
    )


def whole_words(query: str, offer: Offer) -> bool:
    """Los sinónimos deben coincidir por palabras completas (con tolerancia a errores de ortografía).
    Sin esto, "tensiómetro" contiene "tensión" y el agente ofrecía comprar la pastilla de la presión."""
    q_words = strip_stopwords(query).split()
    for term in offer.terms:
        t_words = strip_stopwords(term).split() or term.split()
        hits = sum(any(fuzz.ratio(t, q) >= 85 for q in q_words) for t in t_words)
        if hits == len(t_words) or (len(t_words) >= 2 and 2 * hits >= len(t_words)):
            return True
    return False


def search(query: str, location: dict | None = None, limit: int = 3) -> list[dict]:
    location = location or {"lat": 6.0, "lng": -75.43}
    scored = [(match_score(query, o) if whole_words(query, o) else 0, o) for o in OFFERS]
    best = max((s for s, _ in scored), default=0)
    if best < MIN_SCORE:
        return []
    # Solo el/los productos que mejor coinciden, y que tengan stock.
    hits = [o for s, o in scored if s >= best - 5 and o.stock > 0]
    results = []
    for o in hits:
        d = distance_m(location, o.lat, o.lng)
        # Lo más cercano a la persona primero; a igual distancia, el más barato.
        rank = (d, o.price_cop)
        results.append((rank, {
            "merchant": o.merchant, "wallet": o.wallet, "product": o.product, "category": o.category,
            "priceCOP": o.price_cop, "distanceM": d, "stock": o.stock, "deliveryFeeCOP": o.delivery_fee_cop,
        }))
    results.sort(key=lambda x: x[0])
    return [r for _, r in results[:limit]]
