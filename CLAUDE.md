# CLAUDE.md

## Project Overview (WHAT & WHY)

`paygent` is a hackathon project (Interledger · Open Payments) that makes payment power
**delegable**: a payer approves **one** Open Payments grant in their wallet (the *root mandate*),
and people, devices and AI agents spend inside signed **sub-mandates** carved from it — online, with
no signal (signed offline vouchers), or from a feature phone (SMS + PIN, talking to an agent).

The pitch is always **one mandate → people and agents spending inside it → at any connectivity
level**, never "several features". Read **`docs/producto/context.md`** (the why and the demo script) and
**`docs/api/endpoints.md`** (the api contract) before changing behaviour; **`docs/arquitectura.md`** before moving code.

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
- **Spend modes** (`celular` · `asistente` · `sms`, `mandates.mode`, signed): children of the person branch, created on
  sign-up (40/20/20 split). Agent modes must have `holderId: 'asistente'` or `/pay` rejects them. See `docs/producto/modos-de-consumo.md`.
- **Every route has a guard** (`src/api/src/auth/guards.ts`): people send `Authorization: Bearer <token>` (HMAC from
  `auth/session.ts`), agents `x-api-key` + `x-agent-id`. Payer-only writes use `requireTitularOf`; a new route gets a
  row in the permissions matrix (`docs/api/endpoints.md`) and a case in `test/auth.test.ts`. `x-user-id` is gone.
- **Layers** (`docs/arquitectura.md`, enforced by `test/arquitectura.test.ts`): routes → use cases → rules → `store/`
  repositories (the only place with SQL) and adapters (`op/`, `sms/`). `op/` and `store/` never import the domain.
- **Limits never exceed the parent:** `delegate`/`setLimits` lock the parent row (`for update`); a smaller signed grant
  scales the tree down in proportion (`fitChildren` in `/callback`); spends are reserved under a chain lock before
  paying (`gateway/spend.ts`) and released if the payment fails. A revoked root that is signed again starts empty.
- **New logic ships with a test** (TDD), and a bugfix ships a regression test that fails before
  the fix.

## Gotchas (learned the hard way)

- **Lockfile only with pnpm** — `npm install` in `src/web` breaks Railway's `--frozen-lockfile`. See `docs/operacion/despliegue.md`.
- **Schema changes = new migration**; bump `SEED_VERSION` when the seed changes. See `docs/api/modelo-de-datos.md`.
- **Repositories (`store/*.ts`) and `emit()` are async** — always `await` them; pass `tx` inside a transaction.
- **Open Payments:** token expires as 403 `Inactive Token`; `create` ≠ money arrived; incoming payments must be
  completed. See `docs/open-payments/test-wallet.md` before touching `op/`.
- **Multi-payer:** one root per payer (`root_<userId>`, demo `root`); pass `rootMandateId` / `?root=`.
- **Agents auth:** one `AGENT_SERVICE_KEY` (`x-api-key`) + `x-agent-id`; agents are rows.
- **Verify prod without creating data** (validation paths, reads). A push during the demo restarts the api.
- **PIN length must match** between the api (4–6 digits) and the agents' `PIN` regex in `router.py`, or the PIN reaches the LLM.
- **Phones are E.164** (`normalizarCelular`, `gateway/phone.ts`): SMS arrives as `+57…`; a raw `305…` never matches a profile.
- **Agents build amounts in `profile.asset`** (from `/sms/profile`), never the demo's `/demo/status` currency.
- **Inside `sql().tx`, query with `tx`**: helpers that use the global `sql()` can deadlock on PGlite.
- **PGlite = one connection:** tests cannot reproduce row-lock races between connections, but they do reproduce
  read → await → write races in the app (`pay-concurrente.test.ts`).
- **After a deploy, open tabs load stale lazy chunks** (server returns `index.html`): `RouteError` reloads once (`lib/version.ts`).
- **Teammates push often:** `git fetch` before committing; seed, gateway routes and `rama-detalle.tsx` are merge hot spots.
- **Two doc sources:** `pnpm docs:build` (strict) before pushing `site-docs/`, or the Pages workflow fails on a broken link; a
  visible behaviour change updates both `docs/` (team, Spanish) and `site-docs/` (public, English).
- **Find prod ids read-only:** `GET /api/feed` (events carry `mandateId`), `/api/mandates/:id/tree`, `/api/mandates/:id/modes`.

## Code Style

TypeScript: strict `tsc`. Python: type hints, Pydantic v2. Modular, loosely coupled components;
KISS and YAGNI by default; SOLID reserved for complex business logic (the gateway, mandate
authorization), favouring single responsibility and injected dependencies. Comments explain *why*.
Code comments and user-facing text are in Spanish, matching the existing code.
`TODO <ID>` markers point at backlog task IDs. Separate config files from code. Avoid verbose documentation
inside the code, all comments must be short one-liners and extensive documentation must sit outside the code: `docs/` (team, Spanish) and `site-docs/` (public site, Zensical).

## Layout

| Path | What it is |
|---|---|
| `src/api/` | Fastify API: gateway domain + `/pay` (`gateway/`, HTTP in `gateway/routes/`), Open Payments adapter (`op/`), repositories (`store/`), sessions and guards (`auth/`), body schemas (`http/`), merchants (`merchants/`), app chat (`chat/`), vouchers (`vouchers/`), SMS (`sms/`, `sms-bridge/`), SSE feed (`feed/`), demo seed (`demo/`) |
| `src/web/` | React PWA: `/cuenta` (payer), `/billetera` (beneficiary), `/enlazar` (link with code), `/tendero`, `/celular` (simulated phone); `/juan` and `/maria` redirect |
| `src/shared/` | Shared TS types, amounts, intervals, ed25519 voucher crypto |
| `src/agents/` | FastAPI service: `assistant/`, `inventory/`, `intent/`, `guardian/`, `common/` |
| `docs/producto/` | `context.md` (idea, demo, judge Q&A) · `modos-de-consumo.md` (spend modes, limits) · `backlog.md` (original plan and task IDs, no longer tracked) |
| `docs/arquitectura.md` | Containers, api layers and dependency rules, money path, security, decisions and known trade-offs |
| `docs/api/` | `endpoints.md` (api + agents contract, permissions matrix) · `modelo-de-datos.md` (Postgres schema, payers, seed rules) |
| `docs/operacion/` | `despliegue.md` (Railway services, variables, watch paths, verifying prod) · `sms.md` (real SMS: USB bridge, SMS Gateway, Telnyx) |
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
