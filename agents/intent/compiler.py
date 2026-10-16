"""INT-01: texto de Juan → árbol de mandatos validado contra los invariantes del gateway (GW-03).

El LLM redacta; la billetera de Juan autoriza. Con MOCK_LLM=1 se usa un parser por reglas.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field

from common.config import ANTHROPIC_MODEL, LLM_TIMEOUT_S, MOCK_LLM
from inventory.search import normalize

Category = Literal["mercado", "farmacia", "efectivo", "datos"]
ALL: list[Category] = ["mercado", "farmacia", "efectivo", "datos"]


class Node(BaseModel):
    holderName: str
    holderType: Literal["person", "device", "agent"]
    maxUsd: float = Field(ge=0)
    categories: list[Category]
    pinThresholdUsd: float | None = None
    offlineCapUsd: float | None = None
    children: list["Node"] = []


class InvalidTree(ValueError):
    pass


def validate(node: Node) -> None:
    total = sum(c.maxUsd for c in node.children)
    if total > node.maxUsd + 1e-9:
        raise InvalidTree(f"Los sub-mandatos de {node.holderName} suman ${total:.2f} y el tope es ${node.maxUsd:.2f}")
    for c in node.children:
        extra = set(c.categories) - set(node.categories)
        if extra:
            raise InvalidTree(f"{c.holderName} pide categorías que {node.holderName} no tiene: {', '.join(extra)}")
        validate(c)


def summarize(node: Node, depth: int = 0) -> list[str]:
    extra = ""
    if node.pinThresholdUsd is not None:
        extra += f", PIN si > ${node.pinThresholdUsd:g}"
    if node.offlineCapUsd is not None:
        extra += f", sin señal hasta ${node.offlineCapUsd:g}"
    lines = [f"{'  ' * depth}• {node.holderName}: máx. ${node.maxUsd:g} ({', '.join(node.categories)}{extra})"]
    for c in node.children:
        lines += summarize(c, depth + 1)
    return lines


# ─── Alternativa por reglas ───
MONEY = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:dolares|usd|\$)")
CAT_WORDS = {"farmacia": "farmacia", "medicina": "farmacia", "remedio": "farmacia", "mercado": "mercado",
             "comida": "mercado", "efectivo": "efectivo", "plata": "efectivo"}


def compile_rules(text: str) -> Node:
    t = normalize(text)
    amounts = [float(a.replace(",", ".")) for a in MONEY.findall(t)] or [300.0]
    root_max = max(amounts)
    pin = min(amounts) if len(amounts) > 1 else 10.0
    cats = sorted({c for w, c in CAT_WORDS.items() if w in t}) or ["mercado", "farmacia", "efectivo"]
    person_max = round(root_max * 0.8, 2)
    agent_max = min(round(root_max - person_max, 2), 40.0)
    return Node(
        holderName="Juan", holderType="person", maxUsd=root_max, categories=ALL,
        children=[
            Node(holderName="María", holderType="person", maxUsd=person_max, categories=cats, children=[
                Node(holderName="Celular de María", holderType="device", maxUsd=round(person_max * 0.4, 2),
                     categories=[c for c in cats if c != "efectivo"] or cats, offlineCapUsd=20),
            ]),
            Node(holderName="Asistente de la mamá", holderType="agent", maxUsd=agent_max,
                 categories=[c for c in ["farmacia", "mercado", "datos"]], pinThresholdUsd=pin),
            Node(holderName="Agente Guardián", holderType="agent", maxUsd=0, categories=["datos"]),
        ],
    )


# Para el LLM: lista plana (los esquemas recursivos no son buenos para salidas estructuradas).
class FlatNode(BaseModel):
    holderName: str
    holderType: Literal["person", "device", "agent"]
    parentName: str
    maxUsd: float
    categories: list[Category]
    pinThresholdUsd: float | None = None
    offlineCapUsd: float | None = None


class Plan(BaseModel):
    rootMaxUsd: float
    delegates: list[FlatNode]


def build_tree(plan: Plan) -> Node:
    root = Node(holderName="Juan", holderType="person", maxUsd=plan.rootMaxUsd, categories=ALL)
    nodes = {"Juan": root}
    for d in plan.delegates:
        nodes[d.holderName] = Node(**d.model_dump(exclude={"parentName"}))
    for d in plan.delegates:
        nodes.get(d.parentName, root).children.append(nodes[d.holderName])
    return root


async def compile_llm(text: str) -> Node:
    import anthropic

    client = anthropic.AsyncAnthropic(timeout=LLM_TIMEOUT_S * 3, max_retries=0)
    response = await client.messages.parse(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        system=(
            "Convierte la intención de Juan en mandatos de pago en USD. Juan es la raíz (parentName de sus hijos = 'Juan'). "
            "Delegados típicos: personas (ej. María), su celular (device, hijo de esa persona, con offlineCapUsd), el "
            "Asistente de la mamá (agent, con pinThresholdUsd y categorías farmacia/mercado/datos) y el Agente Guardián "
            "(agent, maxUsd 0). La suma de los hijos nunca supera al padre y sus categorías son subconjunto de las del padre."
        ),
        messages=[{"role": "user", "content": text}],
        output_format=Plan,
        output_config={"effort": "low"},
    )
    if response.parsed_output is None:
        raise ValueError("Sin salida estructurada")
    return build_tree(response.parsed_output)


async def compile_intent(text: str) -> dict:
    node = None
    if not MOCK_LLM:
        try:
            node = await compile_llm(text)
        except Exception:
            node = None
    node = node or compile_rules(text)
    validate(node)
    return {"tree": node.model_dump(), "summary": "\n".join(summarize(node))}
