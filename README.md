# OpenRoute

Poder de pago delegable para personas y sus agentes, incluso sin internet y sin smartphone. Sobre [Open Payments](https://openpayments.dev).

- Qué es y por qué: [proyecto-hackathon-open-payments.md](proyecto-hackathon-open-payments.md)
- Tareas, responsables y contratos: [backlog.md](backlog.md)

## Arranque en 3 comandos

Requisitos: Node ≥ 22, pnpm, [uv](https://docs.astral.sh/uv/) (Python ≥ 3.11).

```bash
cp .env.example .env     # por defecto TODO corre en mock: no hace falta ninguna llave
pnpm setup               # instala Node + Python
pnpm dev                 # api :3001 · web :5173 · agents :8000
```

Abre http://localhost:5173. Hay 5 vistas: `/juan`, `/maria`, `/tendero`, `/celular`, `/demo`.

| Comando | Qué hace |
|---|---|
| `pnpm test` | Tests de TypeScript (vitest) y Python (pytest) |
| `pnpm e2e` | El guion de la demo completo contra los servicios corriendo (hace reset) |
| `pnpm reset` | `POST /demo/reset`: deja la demo en el estado inicial (conserva el grant de Juan) |
| `pnpm op:smoke` | Prueba de Open Payments **real** sin el gateway (hito H2) |
| `pnpm typecheck` | Typecheck de todos los paquetes TS |

> Si el puerto 8000 está ocupado (Docker, etc.), cambia `AGENTS_URL=http://localhost:8010` en `.env`. La api, Vite y los agentes lo leen de ahí.

## Arquitectura

```
apps/api/          TypeScript · Fastify     Open Payments, Mandate Gateway, /pay, vales, SMS, feed
apps/web/          React + Vite + PWA       /juan /maria /tendero /celular /demo
packages/shared/   TypeScript               contratos (types.ts), montos, firma ed25519 de vales
agents/            Python · FastAPI         Asistente (Claude), Inventario, Intención, Guardián
```

¿Por qué la api está en TypeScript? Open Payments solo tiene SDK oficial para Node, y la verificación de vales tiene que correr igual en el gateway y en el navegador del tendero (sin internet).

```
celular de teclas ──SMS──► api /sms/inbound ──► agents /assistant/message ──► api /pay ──► Open Payments
María (PWA) ──QR vale firmado──► Tendero (PWA, verifica offline) ──al reconectar──► api /vouchers/settle
                                                                                      └► agents /guardian/evaluate
Juan (PWA) ◄── SSE /feed/stream ── api
```

La web llama a todo por el proxy de Vite (`/api/*` → api, `/agents/*` → agents): el celular solo necesita **una** URL (la del túnel).

## Dónde trabaja cada quien

| Rol | Carpeta | Empieza por |
|---|---|---|
| **BE** | [apps/api/src/op/](apps/api/src/op/), [sms/](apps/api/src/sms/), [feed/](apps/api/src/feed/) | `pnpm op:smoke` con las llaves reales → `settle.ts` |
| **LU** | [apps/api/src/gateway/](apps/api/src/gateway/), [vouchers/](apps/api/src/vouchers/), [packages/shared/](packages/shared/), [agents/guardian/](agents/guardian/) | `authorize.ts`, `mandates.ts` y sus tests |
| **DS** | [agents/](agents/) | `assistant/llm.py`, `inventory/catalog.csv`, `tests/` |
| **FE** | [apps/web/src/routes/](apps/web/src/routes/) | Diseño de las vistas; la lógica ya funciona |

Los `TODO <ID>` del código apuntan a la tarea del backlog que falta (`grep -r "TODO "`).

## Flags (`.env`)

| Flag | Por defecto | En la demo |
|---|---|---|
| `MOCK_OP` | `1` (Open Payments simulado) | **`0` siempre.** El dinero es real |
| `MOCK_LLM` | `1` (reglas deterministas) | `0` si hay `ANTHROPIC_API_KEY`; si el LLM falla o tarda, cae solo a reglas |
| `MOCK_SMS` | `1` (vista `/celular`) | `0` si Twilio funciona |
| `MOCK_INVENTORY_PAYMENT` | `0` (el pago al Inventario se verifica) | `0` |

## Pasar a Open Payments real (PRE-01, PRE-02, H2)

1. En el [Test Wallet](https://wallet.interledger-test.dev) crea las wallets (Juan en USD, OpenRoute, Tienda, Farmacia, Puntored, Inventario) y pon sus URLs en `.env`.
2. En la wallet de OpenRoute genera una llave de desarrollador: `OP_KEY_ID` y el archivo `private.key` en la raíz (está en `.gitignore`).
3. `MOCK_OP=0` y `pnpm op:smoke`: abre la URL, aprueba como Juan, pega la URL de vuelta. Debe aparecer un pago de $0.01 en la Tienda.
4. Levanta un túnel (`cloudflared tunnel --url http://localhost:5173` o ngrok) y pon `PUBLIC_API_URL=<túnel>/api` y `WEB_URL=<túnel>`. El túnel también da HTTPS, que la cámara y el service worker necesitan en los celulares.
5. `pnpm dev`, abre `/juan` y pulsa **Aprobar en mi billetera**.

## Datos de la demo (semillas)

- Árbol: Juan $300/mes → María $250 (celular $100 con tope offline $20, techo $50; SMS $50 con PIN siempre) · Asistente $40/semana (PIN si > $10) → Inventario $0.50 · Guardián $0.
- Umbral de PIN del Asistente: **$10** (decisión del equipo). El losartán (≈ $3) se paga sin PIN; la insulina (≈ $21) lo pide.
- Cobro de los comercios: **Tienda Doña Rosa no tiene wallet** y cobra por Puntored a su llave Bre-B (`3105550101`): el pago real va a `WALLET_PUNTORED` con el comercio y la llave en el `metadata`. Farmacia San José y Minimercado El Paisa cobran directo a su wallet. El tendero lo cambia en `/tendero`.
- Entrega: el Asistente pregunta "1 recoger / 2 enviar". Con domicilio paga producto + envío en un solo pago a la tienda, a la dirección que registró Juan (por defecto: casa de María, Vereda La Palma). El costo de envío de cada comercio está en `agents/inventory/merchants.csv` (0 = no hace domicilios).
- PIN de la demo: **1234** · Teléfono de la mamá (Doña Carmen): **+573001112233**.
- Tasa de referencia simulada: 1 USD = 4.000 COP (`FX_COP_PER_USD`).
- Estado en [apps/api/.data/db.json](apps/api/.data/) (borrarlo = empezar de cero). La llave del gateway está en `gateway-key.json` y **no** se borra con el reset, para no invalidar los certificados de los celulares.

## Decisiones pendientes del equipo

- **Base de datos:** es en memoria con respaldo en JSON (cero instalación, reset instantáneo). Si hace falta SQLite, solo cambia `apps/api/src/db.ts`.

## Endpoints

Ver [backlog.md §2](backlog.md). Además de los del contrato, existen: `GET /mandates/:id` (con `remaining`), `GET /merchants`, `GET /merchants/:id/orders`, `GET|PUT /delivery-address/:rootId` (solo Juan; un agente recibe 403), `PUT /merchants/:id/payout` (solo el tendero), `GET /gateway/public-key`, `GET /payments/:id`, `GET /sms/profile`, `POST /mandates/:id/unfreeze`, `POST /guardian/review`, `GET /feed`, `GET /vouchers`, `GET /demo/status`. En agents: `POST /guardian/score`, `POST /assistant/reset`.
