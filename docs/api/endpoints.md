# Endpoints

Referencia única de la api (`src/api`, Fastify, puerto 3001) y del servicio de agentes (`src/agents`, FastAPI,
puerto 8000). En producción la web los expone en `https://paygent.up.railway.app/api/*` y `/agents/*`.

Convenciones:

- **Titular** = quien delega (tiene wallet y mandato raíz). **Beneficiario** = quien recibe una rama.
- Las rutas de un titular reciben su raíz: `?root=<rootMandateId>` o `rootMandateId` en el cuerpo. Sin ella se
  usa la raíz de la demo (`root`).
- **Personas:** `Authorization: Bearer <token>`. El token lo devuelven el login y los registros; es un HMAC firmado
  por la api (`src/api/src/auth/session.ts`), vale 7 días y el cliente no puede elegir su `userId`. El SSE, que no
  admite cabeceras, lo lleva en `?token=`. `x-user-id` ya no identifica a nadie.
- **Agentes:** `x-api-key: <AGENT_SERVICE_KEY>` y `x-agent-id: <id del agente>`. Una petición con `x-api-key` nunca
  hace lo que decide una persona (403).
- Columna **Quién** (guardias en `src/api/src/auth/guards.ts`): *pública* · *sesión* (cualquier cuenta) ·
  *titular* (dueño de la raíz del árbol) · *cadena* (la persona dueña de la rama o su titular) · *agente* ·
  *tendero* (dueño del comercio). *cadena o agente* = lecturas que hacen ambos.
- Errores: `{ "error": "<mensaje legible>" }` con 400 (datos), 401 (credencial), 403 (regla del gateway),
  404, 409 (duplicado) o 503 (agentes caídos).

### Quién puede llamar a cada ruta

| Quién | Rutas |
|---|---|
| pública | `POST /auth/*`, `GET /callback*`, `GET /demo/status`, `GET /fx`, `GET /merchants`, `GET /gateway/public-key`, `GET /health*`, `POST /vouchers/settle` (cada vale trae su firma y la de su certificado), `POST /sms/inbound` (simulador y puente adb; ver riesgos en `docs/arquitectura.md`) |
| sesión | `POST /merchants` (queda a nombre de esa cuenta), `POST /agents` |
| titular | `POST /mandates/root`, `POST /mandates/:id/{delegate,revoke,unfreeze,beneficiaries,modes}`, `PATCH /mandates/:id/{limits,modes}`, `GET\|PUT\|DELETE /mandates/:id/sms`, `PUT /delivery-address/:rootId`, `GET /feed` y `/feed/stream` de su raíz, `POST /demo/reset` (Juan) |
| titular o Guardián | `PATCH /mandates/:id/restrict`, `POST /guardian/review` |
| cadena | `POST /mandates/:id/device-key` (o solo el código, mientras ninguna cuenta haya reclamado la rama: es el enlazado de `/enlazar`), `POST /asistente/chat` (de su rama) |
| cadena o agente | `GET /mandates/:id`, `GET /mandates/:id/tree`, `GET /mandates/:id/modes`, `GET /delivery-address/:rootId`, `GET /payments/:id` |
| agente | `POST /pay` (y solo con mandatos de los que es titular), `GET /sms/profile`, `GET /vouchers` |
| tendero | `GET /merchants/:id/orders`, `GET /merchants/:id/payments`, `PUT /merchants/:id/payout`, `GET /merchants/:id/credits` |

## Cuentas

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /auth/login` | `{ email, password }` | Cuenta: `{ id, role: titular\|beneficiario\|tendero, name, apellido, documento, telefono, email, walletAddress, rootMandateId, mandateId, mandateIds, merchantId, token }` |
| `POST /auth/register/titular` | `{ documento, nombre, apellido, email, telefono, password, walletAddress }` | La cuenta (201). Crea su fila en `payers` y **su mandato raíz** (`root_<userId>`) |
| `POST /auth/register/tendero` | `{ documento, nombre, email, telefono, password, tienda, categoria, llave?, wallet? }` | La cuenta con `merchantId` (201) y su tienda en la misma transacción. Sin `wallet` cobra por Puntored a su llave Bre-B (`llave` o, si falta, el celular) |
| `POST /auth/register/beneficiario` | `{ documento, nombre, email, telefono, password, mandateId }` | La cuenta (201). `mandateId` = el código que dio el titular |

## Titular: mandato raíz y beneficiarios

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /mandates/root` | `{ rootMandateId?, maxDebit?, interval?, walletAddress? }` | `{ redirectUrl }`: consentimiento en la billetera del titular |
| `GET /callback/:rootId` | `interact_ref`, `hash` (los pone la billetera) | Redirect a la web (`?ok=1` / `?ok=0`). Si el grant aprobado es menor que lo repartido, las ramas bajan en proporción, en cascada. Si la raíz estaba **revocada**, arranca sin beneficiarios: se borran sus ramas (con sus pagos) y las cuentas de beneficiario que se quedan sin rama, para poder registrarlas otra vez |
| `GET /demo/status?root=` | — | `{ rootGrant, mockOp, mockSms, asset, fxCopPerUsd, fx }` |
| `GET /fx` | — | `{ copPerUsd, fecha, fuente: 'trm' \| 'respaldo' }`: TRM del día (Superfinanciera, datos.gov.co), una consulta por día en Bogotá. Si falla, la última conocida o `FX_COP_PER_USD` (`fecha: null`). La usan gateway, web y agentes |
| `POST /mandates/:raíz/beneficiaries` | `{ alias, maxDebit, pin, offlineCap }` (todo obligatorio, en la moneda del árbol) | `{ code, mandateId, modes }` (201). Crea la persona (PIN siempre) y sus tres modos (`docs/producto/modos-de-consumo.md`) |
| `GET /mandates/:id/modes` | — | `{ personaId, personaName, budget, budgetMax, reserved, remaining, modes }`: modos vivos de la persona (o de la de esa rama de modo); `remaining` es lo que la persona aún puede gastar entre todos sus modos (mínimo en la cadena, lo que muestra la billetera); cada modo con `maxDebit`, `minDebit`, `spent`, `remaining`, techo sin señal y número SMS |
| `PATCH /mandates/:persona/modes` | `{ budget?, limits: { mandateId, maxDebit?, offlineCap? }[] }` (titular) | Cambia el tope de la persona (`budget`, hasta `budgetMax`) y lo reparte entre sus modos en una transacción (todo o nada). Devuelve lo mismo que el `GET` |
| `POST /mandates/:persona/modes` | — | `{ created, personaId, modes }`. Habilita los modos que falten. Solo el titular |
| `GET\|PUT /delivery-address/:rootId` | `{ recipientName, address }` | Dirección de entrega de ese árbol |

## Mandatos

| Método y ruta | Entrada | Salida |
|---|---|---|
| `GET /mandates/:id` | — | `Mandate` + `remaining` |
| `GET /mandates/:id/tree` | — | Árbol con gasto por rama |
| `POST /mandates/:id/delegate` | `Partial<Mandate>` del hijo | `Mandate` firmado (invariantes GW-03) |
| `POST /mandates/:id/revoke` | — | `{ revoked: string[] }`. Si es una raíz, cancela también su grant |
| `PATCH /mandates/:id/restrict` | `{ offlineCap?, frozen? }` | `Mandate` (solo restringe) |
| `PATCH /mandates/:id/limits` | `{ maxDebit?, offlineCap? }` | `Mandate`. Solo el titular: sube o baja dentro del padre; `offlineCap` es el techo sin señal |
| `POST /mandates/:id/unfreeze` | — | `Mandate` |
| `POST /mandates/:id/device-key` | `{ publicKey }` | `{ deviceKeyId, cert, offlineCap, gatewayPublicKey }` |
| `GET /mandates/:id/sms` | — | `{ active, phone? (enmascarado), mandateId? }` |
| `PUT /mandates/:id/sms` | `{ phone, pin }` (titular) | Activa o cambia el SMS de la rama: si la persona ya tiene el modo SMS, conecta esa hoja; si no, crea una. PIN siempre |
| `DELETE /mandates/:id/sms` | Titular | Apaga el SMS y revoca la hoja del Asistente |
| `GET /gateway/public-key` | — | `{ publicKey }` |

## Pagos, vales y comercios

| Método y ruta | Entrada | Salida |
|---|---|---|
| `POST /pay` (agente) | `{ mandateId, merchantWallet, amount, category, reason, price?, pin?, pendingId?, delivery? }` | `AuthDecision & { paymentId? }`. PIN: 3 intentos por compra pendiente y **5 fallos seguidos por mandato** (en cualquier compra) lo bloquean 15 min → `pin_locked`, con aviso en el feed. Monto en otra moneda o escala que la rama → `currency`. Confirmar la misma compra pendiente dos veces a la vez paga una sola |
| `GET /payments/:id` | — | `Payment` (`completed` solo si el comercio recibió el dinero) |
| `POST /vouchers/settle` | `{ vouchers: Voucher[] }` | `{ results: { voucherId, status, reason?, paymentId? }[] }`. Cada vale se reclama en la base antes de pagarlo: el mismo vale presentado dos veces a la vez se paga una sola vez (el segundo → `replay`, sin congelar mientras el primero se paga) |
| `GET /vouchers` | — | Vales recibidos |
| `POST /guardian/review` | — | Cambios de tope offline propuestos por el Guardián |
| `GET /merchants` · `POST /merchants` | `{ id?, name, category, wallet \| payout }` | Lista · comercio creado (201) |
| `GET /merchants/:id/orders` | — | Pedidos con entrega |
| `GET /merchants/:id/payments` | — | Todo lo que recibió el comercio (vales liquidados y compras del Asistente), del más nuevo al más viejo, hasta 200: `Payment & { received }`, con `received` = lo que llegó en su moneda. Es la caja del tendero |
| `PUT /merchants/:id/payout` | `{ via: wallet, wallet }` o `{ via: puntored, llave }` | Comercio |
| `GET /merchants/:id/credits` | — | `PuntoredCredit[]`: lo que Puntored le acreditó (o no) a la tienda por cada pago, con llave enmascarada, referencia Bre-B y comisión. Cada acreditación también va al feed (`kind: payout`) |
| `POST /agents` | `{ id?, name, role, walletAddress? }` | Agente creado (201), sin clave propia |

## Feed, canales y salud

| Método y ruta | Entrada | Salida |
|---|---|---|
| `GET /feed?root=` · `GET /feed/stream?root=` (SSE) | — | Eventos del árbol de ese titular (sin `root`, la demo). Solo su titular |
| `POST /sms/inbound` | `{ From, Body }` (JSON o form de Twilio) | `{ reply }` |
| `GET /sms/profile?phone=` | — | Perfil del Asistente para ese canal, con `asset` (la moneda de su árbol), `titularName` (quien delegó) y `deliveryAddress`. El canal `app:<persona>` es el chat de la app |
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
