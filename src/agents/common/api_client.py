"""Cliente HTTP hacia src/api (AG-01). El agente se autentica con su API key."""

import httpx

from .config import AGENT_ID, AGENT_SERVICE_KEY, API_URL


class Api:
    def __init__(self, agent_id: str = AGENT_ID, base_url: str = API_URL):
        self._client = httpx.AsyncClient(
            base_url=base_url, headers={"x-api-key": AGENT_SERVICE_KEY, "x-agent-id": agent_id}, timeout=30,
        )
        self._asset: dict | None = None

    async def _get(self, path: str, **params):
        r = await self._client.get(path, params=params or None)
        r.raise_for_status()
        return r.json()

    async def profile(self, phone: str) -> dict | None:
        try:
            return await self._get("/sms/profile", phone=phone)
        except httpx.HTTPStatusError:
            return None

    async def root_asset(self) -> dict:
        """Moneda de la wallet de Juan, según la api. No cambia mientras la api corre."""
        if self._asset is None:
            self._asset = (await self._get("/demo/status"))["asset"]
        return self._asset

    async def fx(self) -> dict:
        """TRM vigente: {copPerUsd, fecha, fuente}."""
        return await self._get("/fx")

    async def mandate(self, mandate_id: str) -> dict:
        return await self._get(f"/mandates/{mandate_id}")

    async def payment(self, payment_id: str) -> dict | None:
        try:
            return await self._get(f"/payments/{payment_id}")
        except httpx.HTTPStatusError:
            return None

    async def merchants(self) -> list[dict]:
        return await self._get("/merchants")

    async def pay(self, **body) -> dict:
        """POST /pay → AuthDecision & { paymentId? }. El gateway decide; el agente solo propone."""
        r = await self._client.post("/pay", json=body)
        if r.status_code >= 400:
            return {"result": "deny", "reason": "http_error", "detail": r.text}
        return r.json()


api = Api()
