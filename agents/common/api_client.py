"""Cliente HTTP hacia apps/api (AG-01). El agente se autentica con su API key."""

import httpx

from .config import AGENT_KEY_ASSISTANT, API_URL


class Api:
    def __init__(self, api_key: str = AGENT_KEY_ASSISTANT, base_url: str = API_URL):
        self._client = httpx.AsyncClient(base_url=base_url, headers={"x-api-key": api_key}, timeout=30)

    async def _get(self, path: str, **params):
        r = await self._client.get(path, params=params or None)
        r.raise_for_status()
        return r.json()

    async def profile(self, phone: str) -> dict | None:
        try:
            return await self._get("/sms/profile", phone=phone)
        except httpx.HTTPStatusError:
            return None

    async def mandate(self, mandate_id: str) -> dict:
        return await self._get(f"/mandates/{mandate_id}")

    async def payment(self, payment_id: str) -> dict | None:
        try:
            return await self._get(f"/payments/{payment_id}")
        except httpx.HTTPStatusError:
            return None

    async def pay(self, **body) -> dict:
        """POST /pay → AuthDecision & { paymentId? }. El gateway decide; el agente solo propone."""
        r = await self._client.post("/pay", json=body)
        if r.status_code >= 400:
            return {"result": "deny", "reason": "http_error", "detail": r.text}
        return r.json()


api = Api()
