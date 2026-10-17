"""GRD-01 / GRD-02: reglas DETERMINISTAS. La IA solo redacta la explicación (explain.py).

Invariante: el Guardián solo puede restringir. Cualquier tope que proponga lo acota la api
con restrict() contra el techo que autorizó el titular.
"""

from datetime import datetime, timedelta, timezone

from common.money import asset_of, fmt_cop, from_cop, to_cop

VELOCITY_N = 4  # N vales…
VELOCITY_WINDOW = timedelta(minutes=10)  # …en M minutos
MAX_AGE = timedelta(hours=72)
# Umbrales en pesos; se comparan contra el monto convertido a COP.
NEW_MERCHANT_HIGH_COP = 60_000
# Tope sin señal proporcional al techo que fijó el titular (un techo de 50.000 y uno de 2.000.000 se tratan igual):
CAP_STEP_PCT = 0.25  # con buen uso sube un 25 % del techo
MIN_CAP_PCT = 0.10  # con alertas baja a la mitad, nunca por debajo del 10 % del techo
CLEAN_TO_RAISE = 3

# GRD-03: historial simulado de 30 días (liquidaciones limpias) para que el puntaje tenga sentido en la demo.
SIMULATED_CLEAN_SETTLEMENTS = {"maria-device": 12}
# Comercios donde María ya compra (por id: la dirección de cobro sale de la api, ver guardian/router.py).
# Antes eran URLs fijas que quedaron viejas: un vale alto en la tienda de siempre salía como "comercio nuevo".
SIMULATED_KNOWN_MERCHANT_IDS = {"maria-device": {"tienda", "farmacia"}}


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def evaluate(vouchers: list[dict], history: list[dict], now: datetime | None = None,
             known_merchants: dict[str, set[str]] | None = None) -> list[dict]:
    """known_merchants: por mandato, direcciones de cobro donde ya compra (historial simulado de la demo)."""
    now = now or datetime.now(timezone.utc)
    decisions = []
    for v in vouchers:
        device = v["deviceKeyId"]
        mandate = v["deviceCert"]["mandateId"]
        same_device = [h for h in history + vouchers if h["deviceKeyId"] == device]
        flags: list[tuple[str, str]] = []

        created = _dt(v["createdAt"])
        recent = [h for h in same_device if abs(_dt(h["createdAt"]) - created) <= VELOCITY_WINDOW]
        if len(recent) >= VELOCITY_N:
            flags.append(("velocidad", f"{len(recent)} vales en menos de 10 minutos"))
        if now - created > MAX_AGE:
            flags.append(("vale_antiguo", "el vale tiene más de 3 días"))
        known = {h["merchantWallet"] for h in history if h["deviceKeyId"] == device}
        known |= (known_merchants or {}).get(mandate, set())
        if v["merchantWallet"] not in known and to_cop(v["amount"]) > NEW_MERCHANT_HIGH_COP:
            flags.append(("comercio_nuevo_monto_alto", f"comercio nuevo y monto alto ({fmt_cop(to_cop(v['amount']))})"))

        if not flags:
            decisions.append({"voucherId": v["voucherId"], "action": "approve", "rule": "", "explanation": ""})
            continue
        action = "freeze" if len(flags) >= 2 else "flag"
        rule = ", ".join(f[0] for f in flags)
        why = "; ".join(f[1] for f in flags)
        verb = "Congelé el dispositivo" if action == "freeze" else "Marqué para revisión"
        decisions.append({"voucherId": v["voucherId"], "action": action, "rule": rule,
                          "explanation": f"{verb}: {why}."})
    return decisions


def score(mandate_id: str, holder: str, offline_cap: dict, ceiling: dict, frozen: bool, history: list[dict]) -> dict:
    """Puntaje de confianza → nuevo tope offline, siempre ≤ el techo que autorizó el titular."""
    clean = sum(1 for h in history if h.get("status") == "settled") + SIMULATED_CLEAN_SETTLEMENTS.get(mandate_id, 0)
    alerts = sum(1 for h in history if h.get("status") in ("rejected", "flagged"))
    cap, top = to_cop(offline_cap), to_cop(ceiling)

    if frozen or alerts:
        new = max(round(top * MIN_CAP_PCT), round(cap / 2))
        why = f"bajé el tope offline de {holder} de {fmt_cop(cap)} a {fmt_cop(new)} por {alerts} alerta(s)"
    elif clean >= CLEAN_TO_RAISE and cap < top:
        new = min(top, cap + round(top * CAP_STEP_PCT))
        why = f"subí el tope offline de {holder} de {fmt_cop(cap)} a {fmt_cop(new)}: {clean} compras liquidadas sin problemas (techo que autorizó el titular: {fmt_cop(top)})"
    else:
        new = cap
        why = "sin cambios"
    return {"newCap": from_cop(new, asset_of(offline_cap)), "explanation": why[0].upper() + why[1:] + "."}
