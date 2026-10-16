# CLAUDE.md

## Project Overview (WHAT & WHY)

`paygent` is a hackathon project (Interledger · Open Payments) that makes payment power
**delegable**: a payer approves **one** Open Payments grant in their wallet (the *root mandate*),
and people, devices and AI agents spend inside signed **sub-mandates** carved from it — online, with
no signal (signed offline vouchers), or from a feature phone (SMS + PIN, talking to an agent).

The pitch is always **one mandate → people and agents spending inside it → at any connectivity
level**, never "several features". Read **`docs/producto/context.md`** (the why and the demo script) and
**`docs/api/endpoints.md`** (the api contract) before changing behaviour.

**Stack:** TypeScript (Node ≥ 22, Fastify, `@interledger/open-payments`) · React + Vite PWA ·
Python ≥ 3.11 (FastAPI, Anthropic SDK, uv) · pnpm workspaces. LangGraph is under consideration for
the agents but not adopted — do not add it without a concrete need.

## Core Directives (HOW)

**Money moves for real.** With `MOCK_OP=0` every payment is a real Outgoing Payment on the
Interledger test network. That is the point of the demo and the main risk of working here.

Two rules follow:

- **The gateway decides, never the model.** Every spend — person, device or agent — goes through
  `/pay` in `src/api/src/gateway/`, which enforces the sub-mandate limit, categories and PIN. An
  agent proposes; it holds no keys and no funds.
- **Non-custodial.** Each payment goes straight from the payer's wallet to the final recipient under
  the root grant. Nothing in the middle holds money.

## Commands

```bash
fnm use                           # Node 22 (.node-version); web tests fail on Node 24 (jsdom AbortSignal)
cp .env.example .env              # defaults run everything in mock mode, no keys needed
pnpm setup                        # pnpm install + uv sync in src/agents
pnpm dev                          # api :3001 · web :5173 · agents :8000
pnpm test                         # vitest (src/shared, src/api) + pytest (src/agents)
pnpm typecheck
pnpm op:smoke                     # real Open Payments round trip without the gateway (MOCK_OP=0)
pnpm e2e                          # full demo script against running services (resets state)
pnpm reset                        # POST /demo/reset

cd src/agents && uv run pytest -q # agents only
npx --yes pnpm@11.18.0 <cmd>      # if pnpm is not installed globally (or `corepack enable`)
MOCK_OP=1 pnpm --filter @openroute/api test   # api tests on in-memory PGlite, even with a real .env
```

## Architecture rules

- **Each tree's currency is its payer's wallet currency** (COP for the hackathon; USD supported;
  stored in `payers`). Every mandate and payment in that tree uses it. Write amounts in pesos and convert with
  `amount.fromCop` / `pesos()` (agents: `from_cop`); never hardcode an asset code.
- **The 5 agent rules are invariants, not prompts.** An agent is a leaf of the tree and never spends
  beyond its sub-mandate; permissions only narrow down the tree (monotonicity); above the threshold
  a PIN is required; every agent payment is a real Outgoing Payment; every action lands in the feed
  with its "why". Enforce them in the gateway, with a test — a rule only in an LLM prompt is not
  enforced.
- **The PIN never reaches the LLM.** `src/agents/assistant/router.py` intercepts it first.
- **The Guardian can only restrict.** Its decisions are deterministic rules
  (`src/agents/guardian/rules.py`); the LLM only writes the explanation.
- **Every LLM path has a deterministic fallback.** If the model fails, times out
  (`LLM_TIMEOUT_S`) or `MOCK_LLM=1`, `rules.py` answers. The demo must survive without the LLM.
- **`src/shared/` is the contract.** Types and ed25519 voucher signing run identically in the
  gateway and in the merchant's offline browser. Change both sides together.
- **Mock flags are for development only.** `MOCK_OP` must be `0` in the demo.
- **New logic ships with a test** (TDD), and a bugfix ships a regression test that fails before
  the fix.

## Gotchas (learned the hard way)

- **Lockfile only with pnpm** — `npm install` in `src/web` breaks Railway's `--frozen-lockfile`. See `docs/operacion/despliegue.md`.
- **Schema changes = new migration**; bump `SEED_VERSION` when the seed changes. See `docs/api/modelo-de-datos.md`.
- **`db.ts` and `emit()` are async** — always `await` them.
- **Open Payments:** token expires as 403 `Inactive Token`; `create` ≠ money arrived; incoming payments must be
  completed. See `docs/open-payments/test-wallet.md` before touching `op/`.
- **Multi-payer:** one root per payer (`root_<userId>`, demo `root`); pass `rootMandateId` / `?root=`.
- **Agents auth:** one `AGENT_SERVICE_KEY` (`x-api-key`) + `x-agent-id`; agents are rows.
- **Verify prod without creating data** (validation paths, reads). A push during the demo restarts the api.

## Code Style

TypeScript: strict `tsc`. Python: type hints, Pydantic v2. Modular, loosely coupled components;
KISS and YAGNI by default; SOLID reserved for complex business logic (the gateway, mandate
authorization), favouring single responsibility and injected dependencies. Comments explain *why*.
Code comments and user-facing text are in Spanish, matching the existing code.
`TODO <ID>` markers point at backlog task IDs. Separate config files from code. Avoid verbose documentation
inside the code, all comments must be short one-liners and extensive documentation must sit outside the code using Zensical. 

## Layout

| Path | What it is |
|---|---|
| `src/api/` | Fastify API: Open Payments (`op/`), gateway + `/pay` (`gateway/`), Postgres (`store/`, `db.ts`), accounts (`auth/`), app chat (`chat/`), vouchers (`vouchers/`), SMS (`sms/`, `sms-bridge/`), SSE feed (`feed/`), demo seed (`demo/`) |
| `src/web/` | React PWA: `/cuenta` (payer), `/billetera` (beneficiary), `/enlazar` (link with code), `/tendero`, `/celular` (simulated phone); `/juan` and `/maria` redirect |
| `src/shared/` | Shared TS types, amounts, intervals, ed25519 voucher crypto |
| `src/agents/` | FastAPI service: `assistant/`, `inventory/`, `intent/`, `guardian/`, `common/` |
| `docs/producto/` | `context.md` (idea, demo, judge Q&A) · `backlog.md` (original plan and task IDs, no longer tracked) |
| `docs/api/` | `endpoints.md` (api + agents contract) · `modelo-de-datos.md` (Postgres schema, payers, seed rules) |
| `docs/operacion/despliegue.md` | Railway services, variables, watch paths, verifying prod |
| `docs/open-payments/` | `test-wallet.md` (verified behaviour and gotchas) · `openpayments-guide.md` (primer; 845 KB with embedded images — avoid reading it whole) |
| `AI_USAGE.md`, `prompts/` | Hackathon AI-usage declaration and prompt log |

One `.env` at the repo root feeds api, web (Vite proxy) and agents. API state lives in Postgres
(`DATABASE_URL`; schema in `src/api/src/store/migrations.ts`). Without it, PGlite in
`src/api/.data/pglite` (git-ignored; delete it to start fresh). Payer and merchant wallets, agents and
accounts are rows, not env vars. `private.key` lives at the root and is git-ignored — never commit keys.

## Open Payments setup

1. In the [Test Wallet](https://wallet.interledger-test.dev) create the demo wallets and put their
   addresses in `src/api/src/demo/wallets.ts` (seed) or register them via the api (`POST /merchants`).
2. On the client wallet (`OP_CLIENT_WALLET`) generate a developer key: set `OP_KEY_ID` and save
   the private key as `./private.key`.
3. `MOCK_OP=0` and `pnpm op:smoke` — approve the grant in the browser; a 40 COP payment must appear.
4. For phones, expose the web via a tunnel and set `PUBLIC_API_URL` / `WEB_URL`.

## Tools

- **ctx7 CLI / context7 MCP** — current docs for the Open Payments SDK, Fastify, Vite, FastAPI and
  the Anthropic SDK. Prefer it over recalling an API; the Open Payments SDK changes between majors.
- **Open Payments references** — https://openpayments.dev and
  https://github.com/interledger/open-payments (grants, `limits.debitAmount` + `interval`, quotes,
  incoming/outgoing payments).
