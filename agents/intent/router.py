from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .compiler import InvalidTree, compile_intent

router = APIRouter(prefix="/intent", tags=["intent"])


class IntentIn(BaseModel):
    text: str


@router.post("/compile")
async def compile_route(body: IntentIn):
    try:
        return await compile_intent(body.text)
    except InvalidTree as err:
        raise HTTPException(422, str(err))
