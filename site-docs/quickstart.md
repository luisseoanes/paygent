# Quickstart

## Requirements

| Tool | Version |
|---|---|
| Node | 22 (`.node-version`; web tests fail on Node 24) |
| pnpm | 11 |
| [uv](https://docs.astral.sh/uv/) | any recent, with Python ≥ 3.11 |

## Run locally in mock mode

The defaults in `.env.example` mock Open Payments, SMS and the LLM. No keys needed.

```bash
fnm use                  # Node 22
cp .env.example .env
pnpm setup               # pnpm install + uv sync in src/agents
pnpm dev                 # api :3001 · web :5173 · agents :8000
```

Open <http://localhost:5173>.

| View | Who |
|---|---|
| `/cuenta` | Payer (titular): signs the root grant, delegates, revokes |
| `/billetera` | Beneficiary: pays by QR/voucher or chats with the Assistant |
| `/enlazar` | Beneficiary sign-up with the payer's code |
| `/tendero` | Shopkeeper: scans and settles vouchers |
| `/celular` | Simulated feature phone (SMS) |

Demo accounts (password `paygent123`): `juan@paygent.dev`, `maria@paygent.dev`, `tendero@paygent.dev`.
Demo PIN: `1234`. Doña Carmen's phone: `+573001112233`.

!!! tip "Port 8000 busy?"
    Set `AGENTS_URL=http://localhost:8010` in `.env`. The api, Vite and the agents all read it.

## Useful commands

| Command | What it does |
|---|---|
| `pnpm test` | vitest (shared, api, web) + pytest (agents) |
| `pnpm typecheck` | Strict `tsc` on every TS package |
| `pnpm e2e` | Full demo script against running services (resets state) |
| `pnpm reset` | `POST /demo/reset`: reseed the demo, keep Juan's grant |
| `pnpm op:smoke` | Real Open Payments round trip without the gateway |
| `pnpm docs:dev` | Preview this site on <http://localhost:8001> |

## Switch to real Open Payments

!!! warning "Money moves for real"
    With `MOCK_OP=0` every payment is a real Outgoing Payment on the Interledger test network.

1. In the [Test Wallet](https://wallet.interledger-test.dev) create the wallets (payer, Paygent,
   merchants, Puntored, Inventory). Demo wallets live in `src/api/src/demo/wallets.ts`; other
   merchants are added with `POST /merchants`.
2. On Paygent's wallet (`OP_CLIENT_WALLET`) generate a developer key. Put the key id in `OP_KEY_ID`
   and save the private key as `./private.key` (git-ignored).
3. Set `MOCK_OP=0` and run `pnpm op:smoke`. Approve the grant in the browser; a 40 COP payment must
   reach the shop.
4. Log in as `juan@paygent.dev` at `/cuenta` and sign the root mandate in your wallet.

To test phones locally, expose the web through a tunnel (camera and service worker need HTTPS):

```bash
cloudflared tunnel --url http://localhost:5173
# then in .env: PUBLIC_API_URL=<tunnel>/api  WEB_URL=<tunnel>
```

## Demo data

| Item | Value |
|---|---|
| Currency | Juan's wallet currency (COP in mock). Seeds are in pesos; converted with the TRM of the day if Juan pays in USD |
| Tree | See [Overview](index.md#the-mandate-tree) |
| Merchants | Tienda Doña Rosa has **no wallet** and is paid through Puntored to her Bre-B key; Farmacia San José and Minimercado El Paisa are paid to their wallet |
| Delivery | Product + shipping in one payment, to the address Juan registered. Shipping cost per merchant in `src/agents/inventory/merchants.csv` |
| Reset | Keeps Juan's grant (`root_grants`) and the gateway key (`gateway_keys`) so device certificates stay valid |

## Payers and beneficiaries

1. A payer signs up at `/registrarse` with their wallet and signs their own grant from `/cuenta`.
2. **Delegar** (name, cap per period, PIN, offline cap) returns a code.
3. The beneficiary enters the code at `/enlazar` and creates their account. They get three modes:
   phone (vouchers), in-app Assistant and SMS.

## State

- Postgres via `DATABASE_URL`. Empty = embedded PGlite in `src/api/.data/pglite` (delete it to start fresh).
- Schema: `src/api/src/store/migrations.ts`.
