"""Sucursales REALES cerca de la persona: droguerías y supermercados de OpenStreetMap (Overpass, sin llave).

Overpass tarda 30-45 s por consulta, así que nunca se espera dentro de un SMS: los lugares se guardan por zona
(~1 km) durante 7 días, se precalientan al arrancar y, si una zona no está lista, la búsqueda sigue sin
distancias y la zona se descarga en segundo plano para la próxima vez.

    uv run python -m inventory.nearby 6.0 -75.43      # prueba en vivo
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

import httpx

from .search import distance_m, normalize

log = logging.getLogger("inventory.nearby")

OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
RADIUS_M = 20_000
TTL_S = 7 * 24 * 3600
CACHE_DIR = Path(__file__).parent / ".cache"

# Cómo aparece cada cadena de la búsqueda de precios en OpenStreetMap (nombre o marca).
CHAINS = {
    "Pasteur": ("pasteur",),
    "La Rebaja": ("rebaja",),
    "Locatel": ("locatel",),
    "Cafam": ("cafam",),
    "Olímpica": ("olimpica",),
    "Éxito": ("exito",),
    "Carulla": ("carulla",),
}

_zones: dict[str, tuple[float, list[dict]]] = {}
_loading: dict[str, asyncio.Task] = {}


def _key(lat: float, lng: float) -> str:
    return f"{lat:.2f},{lng:.2f}"


def _query(lat: float, lng: float) -> str:
    around = f"around:{RADIUS_M},{lat},{lng}"
    return (f'[out:json][timeout:60];(nwr["amenity"="pharmacy"]({around});'
            f'nwr["shop"~"chemist|supermarket|convenience"]({around}););out center tags;')


async def _download(lat: float, lng: float) -> list[dict]:
    async with httpx.AsyncClient(timeout=90, headers={"User-Agent": "Paygent/0.1 (hackathon Open Payments)"}) as client:
        last: Exception | None = None
        for url in OVERPASS:
            try:
                r = await client.post(url, data={"data": _query(lat, lng)})
                r.raise_for_status()
                elements = r.json().get("elements", [])
                break
            except Exception as err:  # probamos el siguiente servidor
                last = err
        else:
            raise RuntimeError(f"Overpass no respondió: {last}")
    places = []
    for e in elements:
        tags = e.get("tags", {})
        point = e.get("center") or e
        if "lat" not in point or not (tags.get("name") or tags.get("brand")):
            continue
        places.append({"name": tags.get("name") or tags.get("brand"), "brand": tags.get("brand"),
                       "lat": point["lat"], "lng": point["lon"],
                       "kind": "farmacia" if tags.get("amenity") == "pharmacy" or tags.get("shop") == "chemist" else "mercado"})
    return places


def _from_disk(key: str) -> list[dict] | None:
    f = CACHE_DIR / f"{key}.json"
    try:
        saved = json.loads(f.read_text(encoding="utf-8"))
        if time.time() - saved["at"] < TTL_S:
            _zones[key] = (saved["at"], saved["places"])
            return saved["places"]
    except (OSError, ValueError, KeyError):
        pass
    return None


async def _load(lat: float, lng: float) -> list[dict]:
    key = _key(lat, lng)
    places = await _download(lat, lng)
    _zones[key] = (time.time(), places)
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / f"{key}.json").write_text(json.dumps({"at": time.time(), "places": places}), encoding="utf-8")
    except OSError:
        pass  # sin disco escribible seguimos con la memoria
    log.info("Zona %s: %d lugares de OpenStreetMap", key, len(places))
    return places


async def places_near(location: dict, wait_s: float = 0) -> list[dict] | None:
    """Lugares de la zona. Si no están en caché, los descarga en segundo plano y espera a lo sumo `wait_s`."""
    lat, lng = location["lat"], location["lng"]
    key = _key(lat, lng)
    if (hit := _zones.get(key)) and time.time() - hit[0] < TTL_S:
        return hit[1]
    if (saved := _from_disk(key)) is not None:
        return saved
    task = _loading.get(key)
    if task is None or task.done():
        task = _loading[key] = asyncio.create_task(_load(lat, lng))
        task.add_done_callback(lambda t: t.exception() and log.warning("Zona %s: %s", key, t.exception()))
    if wait_s <= 0:
        return None
    try:
        return await asyncio.wait_for(asyncio.shield(task), wait_s)
    except Exception:
        return None


def nearest_branches(places: list[dict], location: dict) -> dict[str, dict]:
    """La sucursal más cercana de cada cadena, con su distancia a la persona."""
    best: dict[str, dict] = {}
    for p in places:
        text = normalize(f"{p['name']} {p.get('brand') or ''}")
        for chain, patterns in CHAINS.items():
            if any(pat in text for pat in patterns):
                d = distance_m(location, p["lat"], p["lng"])
                if chain not in best or d < best[chain]["distanceM"]:
                    best[chain] = {"name": p["name"], "distanceM": d, "lat": p["lat"], "lng": p["lng"]}
    return best


def nearest_places(places: list[dict], location: dict, kind: str | None = None, limit: int = 3) -> list[dict]:
    """Los lugares más cercanos (también los independientes, sin precio en línea)."""
    rows = [{"name": p["name"], "kind": p["kind"], "distanceM": distance_m(location, p["lat"], p["lng"])}
            for p in places if kind is None or p["kind"] == kind]
    return sorted(rows, key=lambda r: r["distanceM"])[:limit]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    lat, lng = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (6.0, -75.43)
    loc = {"lat": lat, "lng": lng}
    places = asyncio.run(places_near(loc, wait_s=120)) or []
    print(f"{len(places)} lugares a menos de {RADIUS_M // 1000} km de {lat},{lng}")
    for chain, b in sorted(nearest_branches(places, loc).items(), key=lambda x: x[1]["distanceM"]):
        print(f"  {chain:<10} {b['distanceM'] / 1000:5.1f} km  {b['name']}")
    print("Droguerías más cercanas:", ", ".join(f"{p['name']} ({p['distanceM']} m)" for p in nearest_places(places, loc, "farmacia")))
