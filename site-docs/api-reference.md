# API reference

The api (`src/api`, Fastify, port 3001) and the agents service (`src/agents`, FastAPI, port 8000).
In production they are exposed under `https://paygent.up.railway.app/api/*` and `/agents/*`.
The Spanish source of truth is `docs/api/endpoints.md` in the repo.

## Conventions

| Topic | Rule |
|---|---|
| Payer vs. beneficiary | **Titular** delegates (has a wallet and root mandate). **Beneficiario** receives a branch |
| Tree scope | Payer routes take `?root=<rootMandateId>` or `rootMandateId` in the body. Default: demo root `root` |
| Agent auth | `x-api-key: <AGENT_SERVICE_KEY>` + `x-agent-id: <agent id>`. An `x-api-key` request can never change addresses, payouts, or create merchants/agents (403) |
| Person auth | `Authorization: Bearer <token>` from login or registration (HMAC-signed by the api, 7 days); the SSE feed takes `?token=`. Who may call each route: [permissions matrix](https://github.com/luisseoanes/paygent/blob/main/docs/api/endpoints.md#quién-puede-llamar-a-cada-ruta) |
| Errors | `{ "error": "<message>" }` · 400 data · 401 credential · 403 gateway rule · 404 · 409 duplicate · 503 agents down |

## Accounts

| Route | Purpose |
|---|---|
| `POST /auth/login` | Validate `{ email, password }`, return the account and its session `token` |
| `POST /auth/register/titular` | New payer with their own root mandate |
| `POST /auth/register/beneficiario` | New beneficiary, linked with the payer's code (`mandateId`) |

## Root mandate and beneficiaries

| Route | Purpose |
|---|---|
| `POST /mandates/root` | Start the root grant → `{ redirectUrl }` to the wallet |
| `GET /callback` · `GET /callback/:rootId` | Grant continuation (wallet redirect) |
| `GET /demo/status?root=` | Grant state, mock flags, currency, FX |
| `GET /fx` | COP/USD reference rate (TRM of the day, fallback `FX_COP_PER_USD`) |
| `POST /mandates/:root/beneficiaries` | Create a person and their three modes → `{ code, mandateId, modes }` |
| `GET /mandates/:id/modes` | The person's modes, budget and remaining |
| `PATCH /mandates/:persona/modes` | Re-split the person's cap across modes (all or nothing; payer only) |
| `POST /mandates/:persona/modes` | Enable missing modes (payer only) |
| `GET`, `PUT /delivery-address/:rootId` | Delivery address of the tree |

## Mandates

| Route | Purpose |
|---|---|
| `GET /mandates/:id` | Mandate + `remaining` |
| `GET /mandates/:id/tree` | Tree with spend per branch |
| `POST /mandates/:id/delegate` | Signed child mandate (monotonicity enforced) |
| `POST /mandates/:id/revoke` | Revoke branch + descendants; on a root, cancel the grant |
| `PATCH /mandates/:id/restrict` | `{ offlineCap?, frozen? }` — can only restrict |
| `PATCH /mandates/:id/limits` | Raise/lower within the parent (payer only) |
| `POST /mandates/:id/unfreeze` | Unfreeze |
| `POST /mandates/:id/device-key` | Register a device key → certificate + gateway public key |
| `GET`, `PUT`, `DELETE /mandates/:id/sms` | SMS channel of a branch (PUT/DELETE payer only) |
| `GET /gateway/public-key` | Gateway ed25519 public key |

## Payments, vouchers and merchants

| Route | Purpose |
|---|---|
| `POST /pay` (agent) | `{ mandateId, merchantWallet, amount, category, reason, price?, pin?, pendingId?, delivery? }` → `allow` / `deny` / `needs_pin` (+ `paymentId`) |
| `GET /payments/:id` | Payment (`completed` only when the merchant received it) |
| `POST /vouchers/settle` | `{ vouchers }` → per-voucher `settled` / `flagged` / `rejected` |
| `GET /vouchers` | Received vouchers |
| `POST /guardian/review` | Offline-cap changes proposed by the Guardian |
| `GET`, `POST /merchants` | List / create a merchant (`wallet` or `payout`) |
| `GET /merchants/:id/orders` | Orders with delivery |
| `PUT /merchants/:id/payout` | `{ via: wallet, wallet }` or `{ via: puntored, llave }` |
| `POST /agents` | Register an agent (no key of its own) |

## Feed, channels and health

| Route | Purpose |
|---|---|
| `GET /feed?root=` · `GET /feed/stream?root=` | Feed events (JSON / SSE) |
| `POST /sms/inbound` | `{ From, Body }` (JSON or Twilio form) → `{ reply }` |
| `POST /sms/smsgate` · `POST /sms/telnyx` | Signed provider webhooks (enabled by `SMS_PROVIDER`) |
| `GET /sms/profile?phone=` | Assistant profile for a channel |
| `POST /asistente/chat` | In-app Assistant chat |
| `POST /demo/reset` | Reseed Juan's demo (`{ full: true }` also drops the grant) |
| `GET /health` · `GET /health/op?root=` | api and Open Payments health |

## Agents service

| Route | Purpose |
|---|---|
| `POST /assistant/message` · `POST /assistant/reset` | Assistant conversation (SMS and chat) |
| `POST /inventory/query` | Paid catalogue query (402 without payment) |
| `POST /inventory/web` · `GET /inventory/nearby` | Live web prices · nearest branches |
| `POST /intent/compile` | Payer's sentence → mandate tree |
| `POST /guardian/evaluate` · `POST /guardian/score` | Voucher rules · offline cap score |
| `GET /health` | Status and whether an LLM is configured |
