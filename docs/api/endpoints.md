# Endpoints

Referencia única de la api (`src/api`, Fastify, puerto 3001) y del servicio de agentes (`src/agents`, FastAPI,
puerto 8000). En producción la web los expone en `https://paygent.up.railway.app/api/*` y `/agents/*`.

Convenciones:

- **Titular** = quien delega (tiene wallet y mandato raíz). **Beneficiario** = quien recibe una rama.
- Las rutas de un titular reciben su raíz: `?root=<rootMandateId>` o `rootMandateId` en el cuerpo. Sin ella se
  usa la raíz de la demo (`root`).
- Los agentes se autentican con `x-api-key: <AGENT_SERVICE_KEY>` y `x-agent-id: <id del agente>`. Una petición
  con `x-api-key` nunca puede cambiar direcciones, cobros ni dar de alta comercios o agentes (403).
- Errores: `{ "error": "<mensaje legible>" }` con 400 (datos), 401 (credencial), 403 (regla del gateway),
  404, 409 (duplicado) o 503 (agentes caídos).
- **Todavía no hay sesión:** el login devuelve la cuenta, pero no emite token.

## Cuentas

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | Cuenta: `{ id, role: titular\|beneficiario\|tendero, name, apellido, documento, telefono, email, walletAddress, rootMandateId, mandateId, mandateIds, merchantId }` |
| `POST /auth/register/titular` | `{ documento, nombre, apellido, email, telefono, password, walletAddress }` | La cuenta (201). Crea su fila en `payers` y **su mandato raíz** (`root_<userId>`) |
| `POST /auth/register/beneficiario` | `{ documento, nombre, email, telefono, password, mandateId }` | La cuenta (201). `mandateId` = el código que dio el titular |

## Titular: mandato raíz y beneficiarios

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /mandates/root` | `{ rootMandateId?, maxDebit?, interval?, walletAddress? }` | `{ redirectUrl }`: consentimiento en la billetera del titular |
| `GET /callback` · `GET /callback/:rootId` | `interact_ref`, `hash` (los pone la billetera) | Redirect a la web (`?ok=1` / `?ok=0`) |
| `GET /demo/status?root=` | — | `{ rootGrant, mockOp, mockSms, asset, fxCopPerUsd }` |
| `POST /mandates/:raíz/beneficiaries` | `{ alias, maxDebit, pin, offlineCap }` (todo obligatorio, en la moneda del árbol) | `{ code, mandateId, modes }` (201). Crea la persona (PIN siempre) y sus tres modos (`docs/producto/modos-de-consumo.md`) |
| `GET /mandates/:id/modes` | — | `{ personaId, personaName, budget, reserved, modes }`: modos vivos de la persona (o de la de esa rama de modo); cada modo con `maxDebit`, `minDebit`, `spent`, `remaining`, techo sin señal y número SMS |
| `PATCH /mandates/:persona/modes` | `{ limits: { mandateId, maxDebit?, offlineCap? }[] }` + `x-user-id` del titular | Reparte el tope entre los modos en una transacción (todo o nada; primero baja, luego sube). Devuelve lo mismo que el `GET` |
| `POST /mandates/:persona/modes` | — | `{ created, personaId, modes }`. Habilita los modos que falten. Solo el titular (`x-user-id`) |
| `GET\|PUT /delivery-address/:rootId` | `{ recipientName, address }` | Dirección de entrega de ese árbol |

## Mandatos

| Método y ruta | Entrada | Salida |
|---|---|---|
| `GET /mandates/:id` | — | `Mandate` + `remaining` |
| `GET /mandates/:id/tree` | — | Árbol con gasto por rama |
| `POST /mandates/:id/delegate` | `Partial<Mandate>` del hijo | `Mandate` firmado (invariantes GW-03) |
| `POST /mandates/:id/revoke` | — | `{ revoked: string[] }`. Si es una raíz, cancela también su grant |
| `PATCH /mandates/:id/restrict` | `{ offlineCap?, frozen? }` | `Mandate` (solo restringe) |
| `PATCH /mandates/:id/limits` | `{ maxDebit?, offlineCap? }` | `Mandate`. Solo el titular (`x-user-id`): sube o baja dentro del padre; `offlineCap` es el techo sin señal |
| `POST /mandates/:id/unfreeze` | — | `Mandate` |
| `POST /mandates/:id/device-key` | `{ publicKey }` | `{ deviceKeyId, cert, offlineCap, gatewayPublicKey }` |
| `GET /mandates/:id/sms` | — | `{ active, phone? (enmascarado), mandateId? }` |
| `PUT /mandates/:id/sms` | `{ phone, pin }` + `x-user-id` del titular | Activa o cambia el SMS de la rama: si la persona ya tiene el modo SMS, conecta esa hoja; si no, crea una. PIN siempre |
| `DELETE /mandates/:id/sms` | `x-user-id` del titular | Apaga el SMS y revoca la hoja del Asistente |
| `GET /gateway/public-key` | — | `{ publicKey }` |

## Pagos, vales y comercios

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /pay` (agente) | `{ mandateId, merchantWallet, amount, category, reason, price?, pin?, pendingId?, delivery? }` | `AuthDecision & { paymentId? }` |
| `GET /payments/:id` | — | `Payment` (`completed` solo si el comercio recibió el dinero) |
| `POST /vouchers/settle` | `{ vouchers: Voucher[] }` | `{ results: { voucherId, status, reason?, paymentId? }[] }` |
| `GET /vouchers` | — | Vales recibidos |
| `POST /guardian/review` | — | Cambios de tope offline propuestos por el Guardián |
| `GET /merchants` · `POST /merchants` | `{ id?, name, category, wallet \| payout }` | Lista · comercio creado (201) |
| `GET /merchants/:id/orders` | — | Pedidos con entrega |
| `PUT /merchants/:id/payout` | `{ via: wallet, wallet }` o `{ via: puntored, llave }` | Comercio |
| `POST /agents` | `{ id?, name, role, walletAddress? }` | Agente creado (201), sin clave propia |

## Feed, canales y salud

| Método y ruta | Entrada | Salida |
|---|---|---|
| `GET /feed?root=` · `GET /feed/stream?root=` (SSE) | — | Eventos del árbol de ese titular (sin `root`, todos) |
| `POST /sms/inbound` | `{ From, Body }` (JSON o form de Twilio) | `{ reply }` |
| `GET /sms/profile?phone=` | — | Perfil del Asistente para ese canal, con `asset` (la moneda de su árbol) |
| `POST /asistente/chat` | `{ mensajes: { rol, texto }[], contexto: { mandato } }` | `{ texto }` |
| `POST /demo/reset` | `{ full? }` | Vuelve a sembrar **solo** la demo de Juan |
| `GET /health` · `GET /health/op?root=` | — | Estado de la api y de Open Payments |

## Agentes (`src/agents`)

| Método y ruta | Uso |
|---|---|
| `POST /assistant/message` · `POST /assistant/reset` | Conversación del Asistente (SMS y chat) |
| `POST /inventory/query` · `POST /inventory/web` · `GET /inventory/nearby` | Inventario (consulta pagada), búsqueda en internet, tiendas cercanas |
| `POST /intent/compile` | Texto de Juan → árbol de mandatos |
| `POST /guardian/evaluate` · `POST /guardian/score` | Reglas del Guardián sobre vales y tope offline |
| `GET /health` | Estado y si hay LLM |
