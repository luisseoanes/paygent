# Configuration

One `.env` at the repo root feeds the api, the web (Vite proxy) and the agents.
Start from `.env.example`: its defaults run everything in mock mode.

## Mock flags

| Flag | Default | Demo / production |
|---|---|---|
| `MOCK_OP` | `1` (Open Payments simulated) | **Always `0`.** Money is real |
| `MOCK_LLM` | `1` (deterministic rules) | `0` with `ANTHROPIC_API_KEY`; falls back to rules on error or timeout |
| `MOCK_SMS` | `1` (`/celular`; providers only log the reply) | `0` with a configured provider |
| `MOCK_INVENTORY_PAYMENT` | `0` (Inventory payment is verified) | `0` |
| `MOCK_FX` | `0` (fetch the TRM of the day) | `0` |

## URLs

| Variable | Default | Notes |
|---|---|---|
| `API_PORT` | `3001` | |
| `API_URL` | `http://localhost:3001` | Where the agents and the web proxy reach the api |
| `AGENTS_URL` | `http://localhost:8000` | Change if port 8000 is busy |
| `WEB_URL` | `http://localhost:5173` | Redirect target after the grant |
| `PUBLIC_API_URL` | `http://localhost:3001` | Public URL of the api (tunnel or production), used for `/callback/:rootId` |

## Open Payments

| Variable | Notes |
|---|---|
| `OP_CLIENT_WALLET` | Paygent's client wallet (signs the requests) |
| `OP_KEY_ID` | Developer key id from the Test Wallet |
| `OP_PRIVATE_KEY_PATH` | Default `./private.key` (git-ignored) |
| `OP_PRIVATE_KEY` | Key contents (PEM or base64). Takes priority over the path; use it on Railway |

Payer and merchant wallets are **not** env vars: they live in the database (`POST /merchants`,
payer sign-up).

## Database and FX

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres. Empty = embedded PGlite in `src/api/.data/pglite` |
| `FX_COP_PER_USD` | Fallback COP/USD rate (default `4000`) when the TRM cannot be fetched |

## Agents

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Without it, the Assistant uses rules |
| `ANTHROPIC_MODEL` | Claude model id |
| `LLM_TIMEOUT_S` | Default `8`; slower answers fall back to rules |
| `SMS_MAX_CHARS` | Default `306` (2 GSM-7 segments) |
| `AGENT_SERVICE_KEY` | Shared secret between api and agents (`x-api-key`) |

## SMS

| Variable | Notes |
|---|---|
| `SMS_PROVIDER` | `twiml` (only `/sms/inbound`) · `smsgate` · `telnyx` |
| `SMSGATE_USERNAME`, `SMSGATE_PASSWORD` | SMS Gateway for Android → Cloud server |
| `SMSGATE_SIGNING_KEY` | Settings → Webhooks → Signing Key |
| `SMSGATE_API_URL` | Empty = the cloud API |
| `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY` | API key and ed25519 webhook public key |
| `TELNYX_FROM_NUMBER`, `TELNYX_MESSAGING_PROFILE_ID` | Sender (E.164) and optional profile |
| `VITE_APP_SMS_GATEWAY_NUMBER` | Bridge phone number shown to the shopkeeper |

## USB SMS bridge (`pnpm sms:bridge`)

| Variable | Notes |
|---|---|
| `SMS_BRIDGE_ALLOW` | Comma-separated numbers allowed to write. Everything else is ignored unread |
| `SMS_BRIDGE_ALIAS` | `<real number>=+573001112233` to talk as Doña Carmen |
| `SMS_BRIDGE_API` | api to forward to (local or production) |
| `SMS_BRIDGE_POLL_MS` | Inbox poll interval (default `3000`) |
| `SMS_BRIDGE_SUB_ID`, `SMS_BRIDGE_ISMS_CODE` | SIM used to send and the `isms` service code |
| `ADB_PATH`, `ADB_SERIAL` | adb binary and device |

## Web (build time)

| Variable | Notes |
|---|---|
| `VITE_APP_API_URL` | `/api` in production; required |
| `VITE_APP_ENABLE_API_MOCKING` | `false` in production |
