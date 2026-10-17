"""Servicio de agentes de Paygent.  uv run python main.py  (puerto según AGENTS_URL del .env)"""

import asyncio
import logging
import os
from urllib.parse import urlparse

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from assistant.router import router as assistant_router
from common.config import ANTHROPIC_MODEL, MOCK_INVENTORY_PAYMENT, MOCK_LLM
from guardian.router import router as guardian_router
from intent.router import router as intent_router
from inventory.router import router as inventory_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # OpenStreetMap tarda ~50 s por zona: se precalienta la de la demo para que el primer SMS ya tenga distancias.
    from common import fx
    from common.api_client import api
    from inventory import nearby
    tasa = asyncio.create_task(fx.keep_fresh(api))
    await nearby.places_near(DEMO_LOCATION)
    yield
    tasa.cancel()


DEMO_LOCATION = {"lat": 6.0, "lng": -75.43}  # la mamá en la demo (semilla de la api)
app = FastAPI(title="Paygent agents", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(assistant_router)
app.include_router(inventory_router)
app.include_router(intent_router)
app.include_router(guardian_router)


@app.get("/health")
async def health():
    return {"ok": True, "mockLlm": MOCK_LLM, "model": None if MOCK_LLM else ANTHROPIC_MODEL,
            "mockInventoryPayment": MOCK_INVENTORY_PAYMENT}


if __name__ == "__main__":
    import uvicorn

    port = urlparse(os.getenv("AGENTS_URL", "http://localhost:8000")).port or 8000
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
