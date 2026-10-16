"""Endpoints del Guardián. Los llama la api al liquidar vales y en /guardian/review."""

from fastapi import APIRouter
from pydantic import BaseModel

from . import rules

router = APIRouter(prefix="/guardian", tags=["guardian"])


class EvaluateIn(BaseModel):
    vouchers: list[dict]
    history: list[dict] = []


class ScoreIn(BaseModel):
    mandateId: str
    holderName: str
    offlineCap: dict
    ceiling: dict
    frozen: bool = False
    history: list[dict] = []


# TODO GRD-04: reescribir `explanation` con el LLM (alternativa: la plantilla actual).
@router.post("/evaluate")
async def evaluate(body: EvaluateIn):
    return {"decisions": rules.evaluate(body.vouchers, body.history)}


@router.post("/score")
async def score(body: ScoreIn):
    return rules.score(body.mandateId, body.holderName, body.offlineCap, body.ceiling, body.frozen, body.history)
