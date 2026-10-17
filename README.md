# Paygent

Poder de pago delegable para personas y sus agentes, incluso sin internet y sin smartphone. Sobre [Open Payments](https://openpayments.dev).

- Qué es y por qué: [docs/producto/context.md](docs/producto/context.md)
- Endpoints (api y agentes): [docs/api/endpoints.md](docs/api/endpoints.md) · modelo de datos: [docs/api/modelo-de-datos.md](docs/api/modelo-de-datos.md)
- Despliegue en Railway: [docs/operacion/despliegue.md](docs/operacion/despliegue.md) · Open Payments en la práctica: [docs/open-payments/test-wallet.md](docs/open-payments/test-wallet.md)
- Producción: https://paygent.up.railway.app

## Arranque en 3 comandos

Requisitos: Node ≥ 22, pnpm, [uv](https://docs.astral.sh/uv/) (Python ≥ 3.11).

```bash
cp .env.example .env     # por defecto TODO corre en mock: no hace falta ninguna llave
pnpm setup               # instala Node + Python
pnpm dev                 # api :3001 · web :5173 · agents :8000
```

Abre http://localhost:5173. Vistas: `/cuenta` (titular), `/billetera` (beneficiario), `/enlazar` (enlazar con el código del titular), `/tendero`, `/celular` (celular de teclas simulado). `/juan` y `/maria` redirigen.

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
src/api/      TypeScript · Fastify    Open Payments, Mandate Gateway, /pay, vales, SMS, feed
src/web/      React + Vite + PWA      /cuenta /billetera /enlazar /tendero /celular
src/shared/   TypeScript              contratos (types.ts), montos, firma ed25519 de vales
src/agents/   Python · FastAPI        Asistente (Claude), Inventario, Intención, Guardián
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
| **BE** | [src/api/src/op/](src/api/src/op/), [sms/](src/api/src/sms/), [feed/](src/api/src/feed/) | `pnpm op:smoke` con las llaves reales → `settle.ts` |
| **LU** | [src/api/src/gateway/](src/api/src/gateway/), [vouchers/](src/api/src/vouchers/), [src/shared/](src/shared/), [src/agents/guardian/](src/agents/guardian/) | `authorize.ts`, `mandates.ts` y sus tests |
| **DS** | [src/agents/](src/agents/) | `assistant/llm.py`, `inventory/catalog.csv`, `tests/` |
| **FE** | [src/web/src/app/routes/](src/web/src/app/routes/), [features/](src/web/src/features/) | Ver [src/web/CLAUDE.md](src/web/CLAUDE.md) |

Los `TODO <ID>` del código apuntan a la tarea del backlog que falta (`grep -r "TODO "`).

## Flags (`.env`)

| Flag | Por defecto | En la demo |
|---|---|---|
| `MOCK_OP` | `1` (Open Payments simulado) | **`0` siempre.** El dinero es real |
| `MOCK_LLM` | `1` (reglas deterministas) | `0` si hay `ANTHROPIC_API_KEY`; si el LLM falla o tarda, cae solo a reglas |
| `MOCK_SMS` | `1` (vista `/celular`; Telnyx solo registra en el log) | `1` con `pnpm sms:bridge`; `0` con un proveedor configurado |
| `MOCK_INVENTORY_PAYMENT` | `0` (el pago al Inventario se verifica) | `0` |

## Pasar a Open Payments real (PRE-01, PRE-02, H2)

1. En el [Test Wallet](https://wallet.interledger-test.dev) crea las wallets (Juan, Paygent, Tienda, Farmacia, Puntored, Inventario; una distinta por comercio). Las de la demo van en [src/api/src/demo/wallets.ts](src/api/src/demo/wallets.ts); otros comercios se dan de alta con `POST /merchants`. Antes, lee [docs/open-payments/test-wallet.md](docs/open-payments/test-wallet.md).
2. En la wallet de Paygent genera una llave de desarrollador: `OP_KEY_ID` y el archivo `private.key` en la raíz (está en `.gitignore`).
3. `MOCK_OP=0` y `pnpm op:smoke`: abre la URL, aprueba como Juan, pega la URL de vuelta. Debe aparecer un pago de 40 COP en la Tienda.
4. Producción corre en Railway ([docs/operacion/despliegue.md](docs/operacion/despliegue.md)). Para probar celulares en local, un túnel (`cloudflared tunnel --url http://localhost:5173`) con `PUBLIC_API_URL=<túnel>/api` y `WEB_URL=<túnel>` (la cámara y el service worker necesitan HTTPS).
5. Entra como `juan@paygent.dev` en `/cuenta` y firma el mandato en tu billetera.

## SMS real con tu celular (`pnpm sms:bridge`)

Sin Twilio: un Android conectado por USB hace de gateway SMS. El puente lee la bandeja con `adb`, reenvía a `<api>/sms/inbound` y contesta con un SMS real (servicio `isms`, sin abrir ninguna app).

1. Activa la depuración USB y comprueba `adb devices`.
2. En `.env` (o en la línea de comandos): `SMS_BRIDGE_ALLOW` con los números que pueden escribir (el celular es personal: **todo lo demás se ignora sin leer el cuerpo**, y los códigos cortos nunca pasan), `SMS_BRIDGE_ALIAS=<tu número>=+573001112233` para hablar como Doña Carmen, `SMS_BRIDGE_API` (local o `https://paygent.up.railway.app/api`), `ADB_SERIAL` y `SMS_BRIDGE_SUB_ID` (la SIM de SMS: `defaultSmsSubId` en `adb shell dumpsys isub`).
3. `pnpm sms:bridge`. Solo atiende mensajes que lleguen después de arrancar.

## SMS real por SMS Gateway for Android (recomendado en Colombia)

Telnyx no tiene números colombianos con SMS. [SMS Gateway for Android](https://docs.sms-gate.app/) convierte un Android con SIM colombiana en el número de Paygent, por su propio internet (sin cable ni computador): la app manda cada SMS entrante al webhook y envía la respuesta.

`POST /sms/smsgate` verifica la firma HMAC-SHA256 (`X-Signature` sobre cuerpo + `X-Timestamp`, ventana de 5 min), responde 200 de inmediato y envía la respuesta por la API de la nube. **Privacidad:** el celular-puente reenvía todo su SMS, así que solo se atienden números con canal SMS activo o un `VALE …`; los códigos cortos nunca reciben respuesta y lo demás se descarta sin registrarse.

1. Instala la app en el celular-puente, activa **Cloud server** y anota usuario y contraseña. En **Settings → Webhooks** copia la **Signing Key**.
2. Variables (Railway o `.env`): `SMS_PROVIDER=smsgate`, `MOCK_SMS=0`, `SMSGATE_USERNAME`, `SMSGATE_PASSWORD`, `SMSGATE_SIGNING_KEY`.
3. Registra el webhook: `curl -u <usuario>:<contraseña> -H 'content-type: application/json' -d '{"url":"https://paygent.up.railway.app/api/sms/smsgate","event":"sms:received"}' https://api.sms-gate.app/3rdparty/v1/webhooks`
4. `VITE_APP_SMS_GATEWAY_NUMBER` = el número del celular-puente (botón **Cobrar por SMS** del tendero).

## SMS real por Telnyx (sin celular conectado)

`POST /sms/telnyx` recibe el webhook de Telnyx, verifica la firma ed25519 (`telnyx-signature-ed25519` + `telnyx-timestamp`, ventana de 5 min), responde 200 de inmediato y envía la respuesta por `POST https://api.telnyx.com/v2/messages`. Usa el mismo despacho que `/sms/inbound`: un `VALE …` se liquida en el gateway y lo demás va al Asistente. Los reintentos de Telnyx (mismo id) se atienden una sola vez.

1. Portal de Telnyx: compra un número con SMS y asígnalo a un perfil de mensajería; en el perfil pon el webhook `https://paygent.up.railway.app/api/sms/telnyx` (API v2) y permite el país de destino (CO).
2. Variables (Railway o `.env`): `SMS_PROVIDER=telnyx`, `MOCK_SMS=0`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY` (Portal → Keys & Credentials → Public Key), `TELNYX_FROM_NUMBER` (E.164) y `TELNYX_MESSAGING_PROFILE_ID`.
3. Con `MOCK_SMS=1` el webhook funciona igual pero la respuesta solo queda en el log.

**Vales por SMS:** sin datos pero con señal, el tendero toca **Cobrar por SMS** en un vale pendiente (`VITE_APP_SMS_GATEWAY_NUMBER` = número del celular-puente). El vale viaja como `VALE <base64url>` (≈140 caracteres, un solo SMS): el certificado se busca por `certId` y el comercio por una huella de su wallet. `/sms/inbound` lo liquida por el mismo camino que `POST /vouchers/settle` (firma, replay, Guardián) y nunca lo pasa al LLM.

## Datos de la demo (semillas)

- Moneda: la de la wallet de Juan (tabla `payers`); en mock, COP. Las semillas están en pesos y, si Juan paga en USD, se convierten con la TRM del día (`GET /fx`).
- Árbol: Juan $1.200.000/mes → María $1.000.000 (celular $400.000 con tope offline $80.000, techo $200.000; SMS $200.000 con PIN siempre; Asistente de María $160.000/mes con PIN si > $40.000, el del chat de su app) · Asistente $160.000/semana (PIN si > $40.000) → Inventario $2.000 · Guardián $0.
- Umbral de PIN del Asistente: **$10** (decisión del equipo). El losartán (≈ $3) se paga sin PIN; la insulina (≈ $21) lo pide.
- Cobro de los comercios: **Tienda Doña Rosa no tiene wallet** y cobra por Puntored a su llave Bre-B (`3105550101`): el pago real va a la wallet del comercio Puntored (tabla `merchants`) con el comercio y la llave en el `metadata`. Farmacia San José y Minimercado El Paisa cobran directo a su wallet. El tendero lo cambia en `/tendero`.
- Entrega: el Asistente pregunta "1 recoger / 2 enviar". Con domicilio paga producto + envío en un solo pago a la tienda, a la dirección que registró Juan (por defecto: casa de María, Vereda La Palma). El costo de envío de cada comercio está en `src/agents/inventory/merchants.csv` (0 = no hace domicilios).
- PIN de la demo: **1234** · Teléfono de la mamá (Doña Carmen): **+573001112233**.
- Tasa COP/USD: la TRM del día de la Superfinanciera (datos.gov.co), que la api consulta una vez al día; si no hay red, la última conocida o `FX_COP_PER_USD` (respaldo; `MOCK_FX=1` la fija). Solo se usa si Juan paga en USD.
- Estado en **Postgres** (`DATABASE_URL`; en Railway, el servicio Postgres). Sin `DATABASE_URL` se usa PGlite en `src/api/.data/pglite` (borrarlo = empezar de cero). El esquema está en `src/api/src/store/migrations.ts`. El reset no borra el grant de Juan (`root_grants`) ni la llave del gateway (`gateway_keys`), para no invalidar los certificados de los celulares.
- Cuentas de demo (contraseña `paygent123`): `juan@paygent.dev` (delega), `maria@paygent.dev` (recibe la delegación), `tendero@paygent.dev` (cobra). Doña Carmen no tiene correo: entra por SMS. Login: `POST /auth/login`.

## Titulares y beneficiarios

- Cualquier titular se registra en `/registrarse` con su wallet: queda con **su propio mandato raíz** y firma su grant desde `/cuenta`.
- Para dar de alta a un beneficiario, el titular pulsa **Delegar** (nombre, tope por periodo, PIN y tope sin señal) y recibe un código. El beneficiario lo escribe en `/enlazar` y crea su cuenta.
- Cada titular ve solo su árbol y su feed. Detalle en [docs/api/modelo-de-datos.md](docs/api/modelo-de-datos.md).

## Decisiones pendientes del equipo

- **Sesión:** `POST /auth/login` valida la cuenta, pero todavía no emite token; los endpoints del panel siguen abiertos.

## Endpoints

Ver [docs/api/endpoints.md](docs/api/endpoints.md).
