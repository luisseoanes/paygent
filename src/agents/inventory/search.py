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


def _load() -> list[Offer]:
    with open(HERE / "merchants.csv", encoding="utf-8") as f:
        merchants = {r["merchant_id"]: r for r in csv.DictReader(f)}
    offers = []
    with open(HERE / "catalog.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m = merchants[r["merchant_id"]]
            offers.append(Offer(
                merchant_id=r["merchant_id"], merchant=m["name"],
                wallet=os.getenv(m["wallet_env"], f"https://ilp.interledger-test.dev/{r['merchant_id']}"),
                product=r["product"], category=r["category"],
                price_cop=int(r["price_cop"]), stock=int(r["stock"]),
                lat=float(m["lat"]), lng=float(m["lng"]),
                terms=[normalize(r["product"])] + [normalize(s) for s in r["synonyms"].split("|")],
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


def search(query: str, location: dict | None = None, limit: int = 3) -> list[dict]:
    location = location or {"lat": 6.0, "lng": -75.43}
    scored = [(match_score(query, o), o) for o in OFFERS]
    best = max((s for s, _ in scored), default=0)
    if best < MIN_SCORE:
        return []
    # Solo el/los productos que mejor coinciden, y que tengan stock.
    hits = [o for s, o in scored if s >= best - 5 and o.stock > 0]
    results = []
    for o in hits:
        d = distance_m(location, o.lat, o.lng)
        # Ranking: precio normalizado + distancia (1 km ≈ $2.000 COP de "costo" de caminar) - bono por stock alto
        rank = o.price_cop + d * 2 - min(o.stock, 10) * 50
        results.append((rank, {
            "merchant": o.merchant, "wallet": o.wallet, "product": o.product, "category": o.category,
            "priceCOP": o.price_cop, "distanceM": d, "stock": o.stock,
        }))
    results.sort(key=lambda x: x[0])
    return [r for _, r in results[:limit]]
