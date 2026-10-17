# Architecture

![Paygent architecture](assets/diagrams/architecture.svg)

## Components

| Path | Stack | Responsibility |
|---|---|---|
| `src/api/` | TypeScript · Fastify · `@interledger/open-payments` | Mandate Gateway and `/pay` (`gateway/`, HTTP in `gateway/routes/`), sessions and guards (`auth/`), repositories (`store/`), Open Payments adapter (`op/`), offline vouchers (`vouchers/`), SMS webhooks (`sms/`), SSE feed (`feed/`), demo seed (`demo/`) |
| `src/web/` | React 19 · Vite · PWA | Payer, beneficiary, shopkeeper and simulated-phone views |
| `src/shared/` | TypeScript | The contract: types, amounts, intervals, ed25519 signing of mandates, device certificates and vouchers |
| `src/agents/` | Python · FastAPI · Anthropic SDK | Assistant, Inventory, Intent compiler, Guardian |
| Postgres | Railway plugin (PGlite locally) | Mandates, grants, payments, vouchers, accounts, feed |

**Why TypeScript for the api?** Open Payments has an official SDK only for Node, and voucher
verification must run identically in the gateway and in the shopkeeper's offline browser.

## Inside the api

A modular monolith with one decision point over money. Each layer only depends on the ones below it, and
`src/api/test/arquitectura.test.ts` checks it on the real imports:

| Layer | Where | Rule |
|---|---|---|
| HTTP | `*/routes.ts`, `gateway/routes/`, `auth/guards.ts`, `http/schemas.ts` | Authenticate, validate the body's shape, call a use case. No SQL |
| Use cases | `gateway/branches.ts`, `pay.ts`, `spend.ts`, `root.ts`, `vouchers/settle.ts`, `merchants/` | One transaction plus its line in the feed |
| Rules | `gateway/authorize.ts` (`authorizeChain`, pure), `gateway/mandates.ts` | Limits, categories, PIN, monotonicity |
| Persistence | `store/*.ts` (one repository per aggregate) | The only place with SQL; never imports the domain |
| Adapters | `op/` (Open Payments), `sms/`, `lib/agents.ts` | `op/` never imports the domain or the demo |

Full rationale, the money path and known trade-offs: [`docs/arquitectura.md`](https://github.com/luisseoanes/paygent/blob/main/docs/arquitectura.md) (Spanish).

## How they talk

```text
feature phone ──SMS──► api /sms/* ──► agents /assistant/message ──► api /pay ──► Open Payments
María (PWA) ──signed voucher QR──► shopkeeper (PWA, verifies offline) ──on reconnect──► api /vouchers/settle
                                                                                         └► agents /guardian/evaluate
Juan (PWA) ◄── SSE /feed/stream ── api
```

- The web calls everything through one origin: `/api/*` → api, `/agents/*` → agents
  (Vite proxy locally, `vite preview` proxy in production). A phone only needs one URL.
- People call the api with a signed session token; agents with `x-api-key: AGENT_SERVICE_KEY` and `x-agent-id: <agent>`.
  Each agent is a row in the `agents` table, not an env var.
- The api calls the agents over HTTP (`AGENTS_URL`). If they are down, the api degrades:
  vouchers that passed the hard checks still settle without the Guardian.

## Design rules

- **The gateway decides, never the model.** Every spend goes through `/pay` (or voucher settlement),
  which walks the mandate chain leaf → root.
- **Non-custodial.** Each payment goes straight from the payer's wallet to the final recipient under
  the root grant.
- **`src/shared/` is the contract.** Change gateway and browser together.
- **Currency comes from the payer's wallet** (COP for the hackathon; USD supported). Every mandate in
  a tree uses it.
- **Every LLM path has a deterministic fallback.** The demo survives without the model.

## Multiple payers

Any payer can register (`/registrarse`) with their own wallet. They get their own root mandate
(`root_<userId>`), sign their own grant and see only their own tree and feed.
