# Agents

`src/agents/` is one FastAPI service (`uv run python main.py`, port 8000, interactive docs at `/docs`).
Agents **propose**; they hold no keys and no funds. Every spend goes through the gateway.

| Agent | Module | Decides with | LLM role |
|---|---|---|---|
| Assistant | `assistant/` | Gateway (`/pay`) + deterministic router | Understands the request, calls tools |
| Inventory | `inventory/` | Fuzzy search (rapidfuzz + synonyms) | None |
| Intent compiler | `intent/` | Pydantic validation of the tree | Drafts the tree from the payer's sentence |
| Guardian | `guardian/` | Deterministic rules (`rules.py`) | None today (explanations are templates) |

## Assistant

- Entry point: `POST /assistant/message` (SMS and in-app chat).
- Claude with tool use (`llm.py`); `rules.py` is the deterministic fallback.
- Flow: find product → propose purchase (pick up or deliver) → `/pay` → PIN if required → pickup/delivery code.
- Delivery: product + shipping in **one** Outgoing Payment to the shop, to the address the payer registered.
- See [SMS & AI Assistant](sms-assistant.md) for the PIN rule and fallbacks.

## Inventory (agent-to-agent payment)

- `POST /inventory/query` costs **40 COP (≈ $0.01) per query**, paid by the Assistant from its own
  sub-mandate (a `datos` child branch).
- Without a `completed` payment to the Inventory wallet it answers `402`. A payment id can be used once.
- Also: `POST /inventory/web` (live prices from public catalogues of Colombian chains) and
  `GET /inventory/nearby` (nearest real branches via OpenStreetMap).
- The village shops' catalogue (`catalog.csv`, `merchants.csv`) is synthetic.

## Intent compiler

`POST /intent/compile`: "up to 300 dollars a month for my mother and María; medicine without asking
up to 10 dollars" → mandate tree. `validate()` rejects children that exceed the parent or add
categories. The payer still approves in their wallet.

## Guardian

The Guardian **can only restrict**. The api applies its proposals with `restrict()`, which refuses
to unfreeze or exceed the payer's ceiling.

**Voucher review** (`POST /guardian/evaluate`):

| Rule | Trigger |
|---|---|
| `velocidad` | ≥ 4 vouchers from the same device within 10 minutes |
| `vale_antiguo` | Voucher older than 72 hours |
| `comercio_nuevo_monto_alto` | New merchant and amount > 60,000 COP |

One flag → `flag` (settled, marked). Two or more → `freeze`.

**Offline cap** (`POST /guardian/score`), run after every settlement batch:

| History | New cap |
|---|---|
| Frozen or any alert | Half, never below 10% of the ceiling |
| ≥ 3 clean settlements | +25% of the ceiling, never above it |
| Otherwise | Unchanged |

Every change lands in the payer's feed with its explanation.
