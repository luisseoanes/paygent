"""Montos en el formato de Open Payments: {value: str (unidades mínimas), assetCode, assetScale}."""

from .config import FX_COP_PER_USD

Amount = dict


def usd(dollars: float) -> Amount:
    return {"value": str(round(dollars * 100)), "assetCode": "USD", "assetScale": 2}


def to_float(a: Amount) -> float:
    return int(a["value"]) / 10 ** a["assetScale"]


def cop_to_usd(cop: float) -> Amount:
    return usd(cop / FX_COP_PER_USD)


def usd_to_cop(a: Amount) -> int:
    return round(to_float(a) * FX_COP_PER_USD)


def fmt_cop(cop: float) -> str:
    return "$" + f"{round(cop):,}".replace(",", ".")


def fmt_usd(a: Amount) -> str:
    return f"${to_float(a):.2f}"
