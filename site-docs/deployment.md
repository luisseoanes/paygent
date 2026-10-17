# Deployment

## Production on Railway

<https://paygent.up.railway.app> — one Railway project, environment `production`, four services.

| Service | Source | Start | Redeploys on changes to |
|---|---|---|---|
| `@openroute/api` | repo root | `pnpm --filter @openroute/api start` (3001) | `src/api/**`, `src/shared/**`, lockfile, workspace files |
| `@openroute/web` | repo root | build `pnpm --filter @paygent/web build` · start `vite preview` on `$PORT` (8080) | `src/web/**`, `src/shared/**`, lockfile, workspace files |
| `agents` | `src/agents` | `python main.py` (8000) | `src/agents/**` |
| `Postgres` | Railway template | — | — |

- The public domain points at the **web** (port 8080). The web proxies `/api/*` and `/agents/*` over
  the private network (`*.railway.internal`).
- Every push to `main` deploys the services whose watched paths changed. A failed build keeps the
  previous version alive.
- **No pushes during the demo:** restarting the api cuts in-flight payments.

### Key variables

| Service | Variables |
|---|---|
| api | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `MOCK_OP=0`, `OP_CLIENT_WALLET`, `OP_KEY_ID`, `OP_PRIVATE_KEY`, `AGENT_SERVICE_KEY`, `PUBLIC_API_URL`, `WEB_URL`, `AGENTS_URL` |
| agents | `API_URL`, `AGENTS_URL`, `AGENT_SERVICE_KEY` (referenced from the api), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `MOCK_LLM=0` |
| web | `API_URL`, `AGENTS_URL` (proxy targets), `VITE_APP_API_URL=/api`, `VITE_APP_ENABLE_API_MOCKING=false` |

### Before pushing

- Use **pnpm** for the lockfile: Railway installs with `--frozen-lockfile`.
- Run `pnpm typecheck`, `pnpm test` (web tests on Node 22) and `pnpm --filter @paygent/web build`.

### Verify and restore

- Read-only checks: `/api/demo/status?root=`, `/api/health/op`, `/agents/health`.
- `Inactive Token` right after a deploy is expected: the token rotates on the next attempt.
- `POST /api/demo/reset` reseeds the demo and keeps Juan's grant; `{ "full": true }` also drops it.

## This documentation site

Built with [Zensical](https://zensical.org) from `site-docs/` (config: `zensical.toml` at the repo root).

```bash
pnpm docs:dev     # preview on http://localhost:8001 (8000 is the agents service)
pnpm docs:build   # static site in ./site (git-ignored)
```

`.github/workflows/docs.yml` builds and deploys it to GitHub Pages on pushes to `main` that touch the
docs. It requires **Settings → Pages → Source: GitHub Actions**.
