"""GRD-01 / GRD-02: reglas DETERMINISTAS. La IA solo redacta la explicación (explain.py).

Invariante: el Guardián solo puede restringir. Cualquier tope que proponga lo acota la api
con restrict() contra el techo que autorizó Juan.
"""

from datetime import datetime, timedelta, timezone

from common.money import fmt_usd, to_float, usd

VELOCITY_N = 4  # N vales…
VELOCITY_WINDOW = timedelta(minutes=10)  # …en M minutos
MAX_AGE = timedelta(hours=72)
NEW_MERCHANT_HIGH_USD = 15.0
CAP_STEP_USD = 15.0
MIN_CAP_USD = 5.0
CLEAN_TO_RAISE = 3

# GRD-03: historial simulado de 30 días (liquidaciones limpias) para que el puntaje tenga sentido en la demo.
SIMULATED_CLEAN_SETTLEMENTS = {"maria-device": 12}
SIMULATED_KNOWN_MERCHANTS = {
    "maria-device": {"https://ilp.interledger-test.dev/dona-rosa", "https://ilp.interledger-test.dev/farmacia-san-jose"},
}


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def evaluate(vouchers: list[dict], history: list[dict], now: datetime | None = None) -> list[dict]:
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
        known |= SIMULATED_KNOWN_MERCHANTS.get(mandate, set())
        if v["merchantWallet"] not in known and to_float(v["amount"]) > NEW_MERCHANT_HIGH_USD:
            flags.append(("comercio_nuevo_monto_alto", f"comercio nuevo y monto alto ({fmt_usd(v['amount'])})"))

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
    """Puntaje de confianza → nuevo tope offline, siempre ≤ techo de Juan."""
    clean = sum(1 for h in history if h.get("status") == "settled") + SIMULATED_CLEAN_SETTLEMENTS.get(mandate_id, 0)
    alerts = sum(1 for h in history if h.get("status") in ("rejected", "flagged"))
    cap, top = to_float(offline_cap), to_float(ceiling)

    if frozen or alerts:
        new = max(MIN_CAP_USD, cap / 2)
        why = f"bajé el tope offline de {holder} de ${cap:.0f} a ${new:.0f} por {alerts} alerta(s)"
    elif clean >= CLEAN_TO_RAISE and cap < top:
        new = min(top, cap + CAP_STEP_USD)
        why = f"subí el tope offline de {holder} de ${cap:.0f} a ${new:.0f}: {clean} compras liquidadas sin problemas (techo de Juan: ${top:.0f})"
    else:
        new = cap
        why = "sin cambios"
    return {"newCap": usd(new), "explanation": why[0].upper() + why[1:] + "."}
