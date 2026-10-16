"""Montos en el formato de Open Payments: {value: str (unidades mínimas), assetCode, assetScale}.

Los agentes piensan en pesos; los montos viajan en la moneda de la wallet de Juan (COP o USD).
"""

from .config import FX_COP_PER_USD

Amount = dict
COP = {"assetCode": "COP", "assetScale": 2}  # como el Test Wallet


def asset_of(a: Amount) -> dict:
    return {"assetCode": a["assetCode"], "assetScale": a["assetScale"]}


def of(asset: dict, major: float) -> Amount:
    return {"value": str(round(major * 10 ** asset["assetScale"])), **asset_of(asset)}


def to_float(a: Amount) -> float:
    return int(a["value"]) / 10 ** a["assetScale"]


def _cop_per_unit(asset_code: str, rate: float) -> float:
    if asset_code == "COP":
        return 1
    if asset_code == "USD":
        return rate
    raise ValueError(f"Sin tasa de referencia para {asset_code}: Juan debe pagar en COP o USD")


def from_cop(cop: float, asset: dict, rate: float = FX_COP_PER_USD) -> Amount:
    """Pesos → moneda raíz. En COP no hay conversión."""
    return of(asset, cop / _cop_per_unit(asset["assetCode"], rate))


def to_cop(a: Amount, rate: float = FX_COP_PER_USD) -> int:
    return round(to_float(a) * _cop_per_unit(a["assetCode"], rate))


def fmt_cop(cop: float) -> str:
    return "$" + f"{round(cop):,}".replace(",", ".")
