# Backlog Paygent — de 0 a 100

Documento de ejecución de [context.md](context.md). Cada tarea tiene responsable, prioridad, estimación, dependencias y criterio de aceptación (CA).

---

## 0. Equipo, roles y reglas

| Código | Persona | Rol principal | Es dueño de |
|---|---|---|---|
| **BE** | Backend | Integración Open Payments | `src/api` → módulo `op/`, `/pay` a nivel de dinero, SMS, feed |
| **LU** | Luis (DS + backend) | Mandate Gateway + Guardián | `src/api` → módulo `gateway/`, `src/shared` (criptografía), reglas de riesgo |
| **DS** | Data science | Agentes de IA + datos | `src/agents/` (Python): Asistente, Inventario, Intención; cifras del pitch |
| **FE** | Frontend | PWAs y panel | `src/web`: `/juan`, `/maria`, `/tendero`, `/demo` |

**Prioridades:**
- **P0:** sin esto no hay demo.
- **P1:** hace ganar.
- **P2:** solo si sobra tiempo.

**Reglas de trabajo:**
1. **`main` siempre funciona.** Se trabaja en ramas cortas y se integra al menos cada 3 horas.
2. **Contratos primero:** a las 2 horas del inicio están congelados los tipos y endpoints de la sección 2. Todo el mundo trabaja contra *mocks* hasta que exista lo real.
3. **Flags de respaldo** en `.env`: `MOCK_SMS`, `MOCK_LLM`, `MOCK_INVENTORY_PAYMENT`. **Nunca `MOCK_OP` en la demo:** el dinero siempre es real.
4. **Standup de 5 minutos** cada 3 horas: qué terminé, qué me bloquea, si hay que recortar.
5. Si una tarea P0 supera el **doble** de su estimación, se avisa en el standup y se decide si se recorta.

---

## 1. Hitos y puntos de corte

| Hito | Cuándo | Qué debe existir | Si no se cumple |
|---|---|---|---|
| **H0** | Antes del hackathon | Todo el épico PRE hecho; respuesta a "¿el Test Wallet soporta `interval` y COP?" | Ajustar el alcance antes de empezar |
| **H1** | D1 + 2h | Contratos congelados, monorepo corriendo, mocks listos | Nadie avanza en integración hasta cerrarlo |
| **H2 — CORTE** | **D1 + 4h** | **Pago real: grant interactivo → Quote → Outgoing, visible en el Test Wallet** | **Todo el equipo se pone en OP-01…OP-04** |
| **H3** | D1 + 10h | `/pay` con mandatos; vale offline verificado por el tendero; Asistente respondiendo en el chat de prueba | Recortar P1 del día 2 |
| **H4** | Noche del D1 | Video de respaldo del flujo básico (grant + pago con QR + vale offline) | — |
| **H5 — Feature freeze** | D2 mediodía | Todo P0 integrado de principio a fin | Aplicar el orden de recorte de la sección 5 |
| **H6 — Code freeze** | D2 − 3h antes del pitch | Solo arreglos críticos; se ensaya | — |

---

## 2. Contratos (congelar en H1)

### 2.1 Tipos compartidos (`src/shared/src/types.ts`)

```ts
type Amount = { value: string; assetCode: string; assetScale: number }

type HolderType = 'person' | 'device' | 'agent'
type Category = 'mercado' | 'farmacia' | 'efectivo' | 'datos'

interface Mandate {
  id: string; parentId: string | null
  holderType: HolderType; holderId: string
  maxDebit: Amount; interval: string            // ISO 8601, ej. "R/2026-10-01T00:00:00Z/P1M"
  spentInPeriod: Amount
  categories: Category[]
  pinThreshold?: Amount; offlineCap?: Amount
  canSpend: boolean; expiresAt: string
  revoked: boolean; frozen: boolean
  signature: string                              // ed25519 del gateway
}

interface Voucher {
  voucherId: string; deviceKeyId: string; deviceCert: string
  merchantWallet: string; amount: Amount
  counter: number; cumulative: Amount
  createdAt: string; signature: string
}

type AuthDecision =
  | { result: 'allow' }
  | { result: 'needs_pin'; pendingId: string }
  | { result: 'deny'; reason: 'over_limit' | 'category' | 'revoked' | 'frozen' | 'expired' | 'bad_signature' | 'replay' }

interface FeedEvent {
  id: string; at: string; mandateId: string
  actor: { type: HolderType; name: string }
  kind: 'payment' | 'agent_to_agent' | 'voucher_settled' | 'guardian' | 'revoked' | 'denied'
  amount?: Amount; merchant?: string; reason?: string   // "por qué" legible
}
```

### 2.2 Endpoints de `src/api` (Node, puerto 3001)

| Método y ruta | Dueño | Entrada | Salida |
|---|---|---|---|
| `POST /mandates/root` | BE | `{ walletAddress, maxDebit, interval }` | `{ redirectUrl }` |
| `GET /callback` | BE | `interact_ref`, `hash` | redirect a `/juan?ok=1` |
| `GET /mandates/:id/tree` | LU | — | árbol de `Mandate` con gasto |
| `POST /mandates/:id/delegate` | LU | `Partial<Mandate>` del hijo | `Mandate` firmado |
| `POST /mandates/:id/revoke` | LU | — | `{ revoked: string[] }` |
| `PATCH /mandates/:id/restrict` | LU | `{ offlineCap?, frozen? }` (solo restringe) | `Mandate` |
| `POST /mandates/:id/device-key` | LU | `{ publicKey }` | `{ deviceKeyId, cert, offlineCap, gatewayPublicKey }` |
| `POST /agents/register` | LU | `{ name, role, walletAddress, publicKey }` | `{ agentId }` |
| `POST /pay` | LU (autorización) + BE (settle) | `{ mandateId, merchantWallet, amount, category, pin?, pendingId?, reason }` + firma del actor | `AuthDecision & { paymentId? }` |
| `POST /vouchers/settle` | LU | `{ vouchers: Voucher[] }` | `{ results: { voucherId, status, reason? }[] }` |
| `POST /sms/inbound` | BE | webhook Twilio (`From`, `Body`) o mock | TwiML / `{ reply }` |
| `GET /feed/stream` | BE | SSE | `FeedEvent` en vivo |
| `POST /demo/reset` | LU | — | restaura las semillas |

### 2.3 Endpoints de `src/agents/` (Python FastAPI, puerto 8000)

| Método y ruta | Dueño | Entrada | Salida |
|---|---|---|---|
| `POST /assistant/message` | DS | `{ phone, text }` | `{ reply }` (≤ 160 caracteres) |
| `POST /inventory/query` | DS (búsqueda) + BE (verificación del pago) | `{ query, location, paymentId }` | `{ options: [{ merchant, wallet, product, priceCOP, distanceM, stock }] }` |
| `POST /intent/compile` | DS | `{ text }` | `{ tree, summary }` |
| `POST /guardian/evaluate` | LU | `{ vouchers, history }` | `{ decisions: [{ voucherId, action, rule, explanation }] }` |

### 2.4 Estructura del repo

```
paygent/
├── src/api/          (TypeScript: Fastify + @interledger/open-payments + better-sqlite3)
│   └── src/{op,gateway,vouchers,sms,feed,demo}/
├── src/web/          (React + Vite + vite-plugin-pwa + Tailwind)
│   └── src/routes/{juan,maria,tendero,celular,demo}/
├── src/shared/       (tipos + tweetnacl: firmar/verificar vales y certificados)
├── src/agents/       (Python: FastAPI + anthropic + rapidfuzz + pydantic)
│   └── {assistant,inventory,intent,guardian}/
├── bruno/             (colección de pruebas de Open Payments)
└── .env.example
```

---

## 3. Backlog por épicos

### ÉPICO PRE — Preparación (antes del hackathon)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| PRE-01 | Crear en el Test Wallet las wallets: Juan (USD), Paygent (cliente), Tienda Doña Rosa, Farmacia San José, Puntored Efectivo, Agente de Inventario. Fondear a Juan | BE | P0 | 1h | — | 6 wallet addresses anotadas en `.env.example`; Juan con saldo |
| PRE-02 | Generar llaves de desarrollador (key id + llave privada) para la wallet de Paygent | BE | P0 | 0.5h | PRE-01 | Llave en `.env` local (nunca en git) |
| PRE-03 | Colección Bruno: grant incoming no interactivo → incoming payment → quote → **grant interactivo con `debitAmount` + `interval`** → continuación → outgoing | BE + LU | P0 | 2h | PRE-02 | Flujo completo ejecutado a mano. **Respuesta documentada:** ¿soporta `interval`? ¿Qué monedas hay (COP)? ¿Cuánto tarda cada paso? |
| PRE-04 | Monorepo (pnpm workspaces + carpeta Python), scripts `dev`, README de arranque, `.env.example` | LU | P0 | 1.5h | — | `pnpm dev` levanta api + web; `uvicorn` levanta agents |
| PRE-05 | Clave de la API de Claude y prueba mínima de *tool use* en Python | DS | P0 | 1h | — | Script que llama una herramienta dummy y devuelve su resultado |
| PRE-06 | Twilio: cuenta, número, envío y recepción de SMS a un celular colombiano; revisar las restricciones de la cuenta de prueba | BE | P1 | 1h | — | SMS de ida y vuelta funcionando, o decisión tomada de usar el mock |
| PRE-07 | Hardware de la demo: 1 celular de teclas (o viejo), 1 Android, 1 iPhone, cable HDMI | Todos | P0 | — | — | Dispositivos probados con la PWA |
| PRE-08 | Cifras con fuente: costo de remesas EE.UU. → Colombia (Banco Mundial RPW), volumen de remesas (Banco de la República), conectividad rural y uso de celulares básicos (MinTIC / DANE / GSMA) | DS | P0 | 2h | — | Tabla con cifra + fuente + fecha; ninguna cifra sin fuente |
| PRE-09 | Túnel público estable (ngrok o cloudflared) para `/callback` y el webhook de Twilio | BE | P0 | 0.5h | — | URL pública que llega a `localhost:3001` |
| PRE-10 | Reunión de contratos: revisar y ajustar la sección 2 | Todos | P0 | 1h | — | Sección 2 aprobada por los 4 |

### ÉPICO OP — Integración Open Payments (BE)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| OP-01 | Cliente autenticado (`createAuthenticatedClient`) con las llaves de Paygent; lectura de wallet addresses | BE | P0 | 1h | PRE-02 | `GET /health/op` devuelve los datos de la wallet de Juan |
| OP-02 | `POST /mandates/root`: grant interactivo `outgoing-payment` con `limits.debitAmount` + `limits.interval`; guardar `continue` (uri, token) y `nonce` | BE | P0 | 2h | OP-01 | Devuelve `redirectUrl` que abre la pantalla de consentimiento del Test Wallet |
| OP-03 | `GET /callback`: verificar `hash`, `grant.continue` con `interact_ref`, guardar el token de acceso y la URL de gestión; crear el `Mandate` raíz | BE | P0 | 1.5h | OP-02, GW-01 | Tras aprobar, existe un mandato raíz con token válido |
| OP-04 | `settle({ merchantWallet, amount, metadata })`: grant incoming (con caché) → incoming payment → quote → outgoing con el token raíz | BE | P0 | 3h | OP-03 | **Pago visible en la wallet del comercio.** Devuelve `{ outgoingPaymentId, debitAmount, receiveAmount }` |
| OP-05 | Caché y precalentado de grants incoming por comercio + rotación de token (`token.rotate`) | BE | P1 | 1.5h | OP-04 | El segundo pago al mismo comercio tarda menos que el primero; un token vencido se rota solo |
| OP-06 | Seguimiento del outgoing (`sentAmount`, `failed`) y emisión de un `FeedEvent` | BE | P1 | 1h | OP-04, BE-FEED | El feed muestra "liquidado" al completar |
| OP-07 | Revocación del grant raíz en el servidor de autorización | BE | P1 | 1h | OP-03 | Después de revocar, un `settle` falla con `revoked` |
| OP-08 | Mapa de errores de Open Payments → razones internas (límite excedido, saldo insuficiente, quote vencida, token inválido) | BE | P0 | 1.5h | OP-04 | Cada error llega a `/pay` como `deny` con una razón legible |
| OP-09 | Intervalo corto para la demo (`PT2M` o `PT5M`) y prueba de renovación | BE | P2 | 1h | PRE-03 | El tope vuelve a estar disponible después del intervalo |
| OP-10 | Capa de presentación FX si no hay COP (tasa fija documentada y marcada como simulada) | BE | P1 | 0.5h | PRE-03 | La UI muestra COP con la etiqueta "tasa de referencia" |
| BE-FEED | `FeedEvent` en SQLite + `GET /feed/stream` (SSE) | BE | P0 | 1.5h | GW-01 | El panel recibe eventos en menos de 1 segundo |
| BE-AUTH | Autenticación de agentes: el agente firma la request (ed25519) con la llave registrada. Alternativa P0: API key por agente | BE | P1 | 1.5h | GW-01 | Una request sin firma válida recibe 401 |

### ÉPICO GW — Mandate Gateway (LU)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| GW-01 | Modelo SQLite: Mandate, Agent, DeviceKey, SmsAuth, Merchant, Voucher, Payment, GuardianEvent, FeedEvent + semillas (Juan, María, mamá, 3 comercios, 3 agentes) | LU | P0 | 2h | PRE-04 | `POST /demo/reset` deja la base en el estado inicial de la demo |
| GW-02 | Llave ed25519 del gateway; firma y verificación de mandatos sobre JSON canónico | LU | P0 | 1.5h | PRE-04 | Test: un mandato alterado falla la verificación |
| GW-03 | `POST /mandates/:id/delegate` con invariantes: suma de hijos ≤ padre, categorías ⊆ padre, vigencia ≤ padre | LU | P0 | 2h | GW-02 | Tests: los 3 invariantes rechazan casos inválidos |
| GW-04 | Motor `authorize(actor, mandateId, amount, category, pin?)`: recorre la cadena hasta la raíz y valida revocado, congelado, vigencia, tope del periodo (ventanas de `interval`), categoría y umbral de PIN | LU | P0 | 3h | GW-03 | Tests por cada razón de `deny` y por `needs_pin` |
| GW-05 | `POST /pay`: autentica al actor → `authorize` → `settle` (OP-04) → actualiza `spentInPeriod` en toda la cadena → `FeedEvent` | LU | P0 | 2h | GW-04, OP-04 | Pago real de principio a fin por `/pay`; el gasto se refleja en todas las ramas |
| GW-06 | Compras pendientes: `needs_pin` crea un `pendingId`; `/pay` con `pendingId` + PIN (hash con salt) la confirma | LU | P0 | 1h | GW-05 | PIN incorrecto → `deny`; correcto → pago real |
| GW-07 | `POST /mandates/:id/revoke` en cascada + freeze/unfreeze | LU | P0 | 1h | GW-03 | Revocar una rama no afecta a sus hermanas |
| GW-08 | `PATCH /mandates/:id/restrict` con **monotonía**: solo baja topes o congela; nunca supera al padre | LU | P0 | 1h | GW-03 | Test: intentar ampliar devuelve 403 |

### ÉPICO OFF — Modo sin señal (LU servidor · FE cliente)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| OFF-01 | `src/shared`: formato de vale, canonicalización, `signVoucher`/`verifyVoucher`, `verifyDeviceCert` (tweetnacl) | LU | P0 | 2h | PRE-04 | Test vectors compartidos pasan igual en el navegador y en Node |
| OFF-02 | `POST /mandates/:id/device-key`: recibe la llave pública y devuelve un certificado con `offlineCap` y la llave pública del gateway | LU | P0 | 1h | OFF-01, GW-02 | El certificado se verifica offline en la PWA del tendero |
| OFF-03 | `POST /vouchers/settle`: firma + certificado + contador único + acumulado consistente + mandato vigente en `createdAt` → Guardián → `settle` de cada vale | LU | P0 | 2.5h | OFF-01, GW-05, GRD-01 | Lote de 3 vales: 2 liquidados y 1 rechazado por replay, con su razón |
| OFF-04 | PWA María: generar el par de llaves, guardarlo en IndexedDB, firmar el vale sin conexión y mostrarlo como QR | FE | P0 | 3h | OFF-01, OFF-02 | En modo avión se genera un QR válido |
| OFF-05 | PWA Tendero: escanear QR (`html5-qrcode`), verificar offline, guardar en la cola de IndexedDB, mostrar ✓/✗ | FE | P0 | 3h | OFF-01 | En modo avión, un vale válido muestra ✓ y uno alterado ✗ |
| OFF-06 | Sincronización: al volver la conexión (evento `online`) enviar la cola a `/vouchers/settle` y mostrar el resultado | FE | P0 | 1.5h | OFF-03, OFF-05 | Al desactivar el modo avión, el vale pasa a "liquidado" solo |
| OFF-07 | Service worker y caché para que ambas PWAs abran en modo avión | FE | P0 | 1.5h | FE-01 | Probado en Android **y** iOS |
| OFF-08 | Botón de demo "reenviar vale" (replay) → rechazo visible + evento del Guardián | FE + LU | P1 | 0.5h | OFF-03 | El fraude aparece en el feed de Juan con su explicación |

### ÉPICO AG — Agente Asistente + SMS (DS · BE)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| AG-01 | Esqueleto FastAPI + cliente HTTP hacia `src/api` (con la firma o API key del agente) | DS | P0 | 1.5h | PRE-04 | `agents` llama a `/pay` de forma autenticada |
| AG-02 | Asistente con Claude *tool use*: `buscar_producto`, `proponer_compra`, `consultar_saldo`, `generar_codigo_retiro`; memoria de sesión por teléfono; español simple; respuestas ≤ 160 caracteres | DS | P0 | 4h | AG-01, INV-02 | "necesito la pastilla de la presión" → propuesta con comercio, precio y distancia |
| AG-03 | Flujo de PIN: la compra propuesta pide PIN → el siguiente mensaje con el PIN confirma vía `/pay` con `pendingId` | DS | P0 | 1h | AG-02, GW-06 | PIN correcto → pago real + SMS con el código de retiro |
| AG-04 | Guardarraíles: ningún pago fuera de las herramientas; validación de montos; respuesta a "no entendí"; **alternativa determinista** si el LLM falla o tarda más de 8 s | DS | P0 | 1.5h | AG-02 | Con `MOCK_LLM=1` la demo sigue funcionando con reglas |
| AG-05 | Respuesta inmediata "Buscando…" + respuesta final asíncrona | DS + BE | P1 | 1h | SMS-01 | El usuario recibe un acuse en menos de 2 s |
| AG-06 | Set de evaluación: 25 mensajes reales (errores ortográficos, "la pasta de la presión", "cuánto me queda", montos en pesos) con su resultado esperado; reportar la tasa de acierto | DS | P1 | 1.5h | AG-02 | ≥ 90% de acierto; la cifra se usa en el pitch |
| SMS-01 | `POST /sms/inbound`: Twilio → `src/agents/assistant/message` → respuesta. Con `MOCK_SMS=1` usa la vista del celular simulado | BE | P0 | 1.5h | AG-01 | Un SMS real o simulado llega al agente y vuelve |
| SMS-02 | Vista `/celular`: UI de celular de teclas (pantalla pequeña, fuente monoespaciada) que usa el mismo endpoint. Es la alternativa si falla Twilio y la vista para el proyector | BE | P0 | 1.5h | SMS-01 | Conversación completa visible en el proyector |

### ÉPICO INV — Agente de Inventario (DS · BE)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| INV-01 | Dataset sintético: ~40 productos (medicamentos comunes + mercado) en 6–8 comercios de un municipio de Antioquia, con precios COP, stock, coordenadas y **sinónimos coloquiales** ("pastilla de la presión" → losartán) | DS | P0 | 2h | — | CSV versionado + documento de cómo se generó |
| INV-02 | Búsqueda: sinónimos + *fuzzy matching* (rapidfuzz) + ranking por precio, distancia y stock | DS | P0 | 2h | INV-01 | Top 3 correcto en 20 consultas de prueba |
| INV-03 | Pago por consulta: `/inventory/query` exige un `paymentId` liquidado a la wallet del Agente de Inventario (verificar el incoming payment) | BE | P0 | 1.5h | OP-04 | Sin pago devuelve 402; con pago responde |
| INV-04 | `FeedEvent` tipo `agent_to_agent` destacado en el panel ("el Asistente le pagó $0.01 al Inventario") | FE | P0 | 0.5h | BE-FEED | Visible en el feed con un estilo propio |

### ÉPICO GRD — Agente Guardián (LU · DS)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| GRD-01 | Reglas deterministas: replay (contador repetido), acumulado inconsistente, velocidad (N vales en M minutos), comercio nuevo + monto alto, vale muy antiguo → `flag` / `freeze` / `lower_cap` | LU | P0 | 2h | OFF-01 | Tests: cada regla se dispara con su caso |
| GRD-02 | Puntaje de confianza por dispositivo → ajuste de `offlineCap` (sube con liquidaciones limpias, baja con alertas), **acotado por el padre** vía GW-08 | DS | P1 | 1.5h | GRD-01, GW-08 | En la demo: "María: $20 → $35", con explicación |
| GRD-03 | Historial simulado de 30 días para que el puntaje tenga sentido en la demo | DS | P1 | 1h | INV-01 | Semilla cargada por `/demo/reset` |
| GRD-04 | Explicación en lenguaje natural con LLM (alternativa: plantilla) → `FeedEvent` tipo `guardian` | DS | P1 | 1h | GRD-01 | Cada decisión muestra un "por qué" legible |

### ÉPICO INT — Compilador de intención (DS · FE)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| INT-01 | Texto → árbol de mandatos (esquema pydantic) + validación contra los invariantes de GW-03 | DS | P1 | 2h | AG-01 | 5 intenciones de prueba generan árboles válidos; una inválida se rechaza con explicación |
| INT-02 | UI de Juan: textarea → vista previa del árbol → "Aprobar en mi billetera" | FE | P1 | 1.5h | INT-01, FE-02 | De la frase al consentimiento real sin tocar un formulario |

### ÉPICO FE — Frontend (FE)

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| FE-01 | React + Vite + PWA + Tailwind, rutas, diseño móvil, cliente API con mocks (MSW) según la sección 2 | FE | P0 | 2h | PRE-10 | Las 4 rutas navegan con datos mock |
| FE-02 | Panel de Juan: formulario del mandato (alternativa P0 al compilador), redirect a la billetera, **árbol visual con gasto por rama**, feed en vivo (SSE), botón revocar por rama | FE | P0 | 4h | FE-01 | Revocar una rama se refleja en el árbol y en el feed |
| FE-03 | PWA María: vincular el dispositivo (código), saldo del periodo, QR en línea + modo offline (OFF-04) | FE | P0 | 1.5h | FE-01, OFF-04 | Pago con QR en línea de principio a fin |
| FE-04 | PWA Tendero: cobrar en línea (escanear → `/pay`), cobrar offline (OFF-05), historial | FE | P0 | 1.5h | FE-01, OFF-05 | El tendero ve lo que recibió, en COP |
| FE-05 | Panel de ahorro frente a remesa tradicional, con las cifras de PRE-08 | FE | P1 | 1h | PRE-08 | Cifras con fuente en pantalla |
| FE-06 | Vista `/demo` para el proyector: 3 columnas (Juan · celular · tendero) + feed | FE | P2 | 2h | FE-02, SMS-02 | El jurado ve todo el flujo en una sola pantalla |

### ÉPICO DEMO — QA, demo y pitch

| ID | Tarea | Resp. | Prio | Est. | Dep. | Criterio de aceptación |
|---|---|---|---|---|---|---|
| DEMO-01 | Guion técnico paso a paso + `POST /demo/reset` que deja todo listo en 1 clic | LU | P0 | 1.5h | GW-01 | Reset + guion completo en menos de 3 minutos |
| DEMO-02 | Prueba de principio a fin ×3 en los dispositivos reales, con la red del lugar del evento | Todos | P0 | 1.5h | H5 | 3 ejecuciones seguidas sin fallos |
| DEMO-03 | Video de respaldo: flujo básico (noche del D1) y completo (D2) | FE | P0 | 1h | H4 | Video en local y en la nube |
| DEMO-04 | Diapositivas (máx. 6): problema con cifras, tesis, arquitectura, real vs. simulado, roadmap | DS | P0 | 2h | PRE-08 | Revisadas por los 4 |
| DEMO-05 | Ensayo del pitch ×5 cronometrado + simulación de preguntas (sección 8 del documento del proyecto) | Todos | P0 | 1.5h | DEMO-04 | 2:00 ± 10 s; todos responden cualquier pregunta |
| DEMO-06 | README del repo + diagrama de arquitectura + "propuesta de extensión para Open Payments" (1 página: delegación, vales offline, `user_code`) | LU | P1 | 1h | — | Enlazado en las diapositivas |
| DEMO-07 | Plan de contingencia impreso: sin red → video; falla Twilio → `/celular`; falla el LLM → `MOCK_LLM`; falla el Test Wallet → video | LU | P0 | 0.5h | — | Todos saben qué hacer y quién lo hace |

---

## 4. Cronograma por persona

Asume D1 de 09:00 a 23:00 y D2 de 08:00 hasta el pitch. Hay que ajustar las horas al horario real del evento.

| Bloque | BE | LU | DS | FE |
|---|---|---|---|---|
| **Antes** | PRE-01, 02, 03, 06, 09 | PRE-03, 04 | PRE-05, 08 | Revisar el diseño; boceto de pantallas |
| **D1 09–11** (H1) | OP-01, OP-02 | GW-01, GW-02 | AG-01, INV-01 | FE-01 |
| **D1 11–13** (H2 corte) | OP-03, **OP-04** | GW-03, OFF-01 | INV-02, AG-02 (inicio) | FE-02 (con mocks) |
| **D1 14–18** | OP-08, BE-FEED, INV-03 | GW-04, GW-05, GW-06 | AG-02, AG-03 | OFF-04, OFF-05 |
| **D1 18–23** (H3, H4) | SMS-01, SMS-02, BE-AUTH | GRD-01, OFF-02, OFF-03 | AG-04, integración con `/pay` real | OFF-06, OFF-07, FE-03 · video (DEMO-03) |
| **D2 08–12** (H5) | OP-05, OP-06, OP-07, AG-05 | GW-07, GW-08, DEMO-01 | GRD-02, GRD-03, GRD-04, INT-01 | FE-04, INV-04, INT-02, FE-05 |
| **D2 12–14** | DEMO-02 (todos) · arreglos | DEMO-02 · DEMO-07 | AG-06 · DEMO-04 | DEMO-02 · pulir UI |
| **D2 14–pitch** (H6) | Soporte a la demo | DEMO-06 | DEMO-04 | DEMO-03 (video final) |
| **Todos** | DEMO-05 ensayo ×5 | | | |

**Carga estimada (P0 + P1):** BE ≈ 22 h · LU ≈ 23 h · DS ≈ 24 h · FE ≈ 22 h. Es exigente: el orden de recorte existe para usarse.

**Ruta crítica:** PRE-03 → OP-01…04 → GW-04/05 → OFF-03 y AG-03. Si algo de esta cadena se atrasa, quien esté libre ayuda **ahí** antes de seguir con lo suyo.

---

## 5. Orden de recorte (si el tiempo no alcanza)

Se recorta de arriba hacia abajo, sin discutirlo de nuevo:

1. FE-06 vista del proyector (P2)
2. OP-09 intervalo corto (se explica verbalmente)
3. INT-01/INT-02 compilador de intención → el formulario de FE-02
4. GRD-04 explicaciones con LLM → plantilla
5. GRD-02/03 ajuste dinámico del tope → tope fijo
6. PRE-06/SMS real → vista `/celular`
7. AG-06 evaluación → se quita la cifra del pitch
8. BE-AUTH firma de agentes → API key

**Nunca se recortan:** OP-01…04, GW-04/05/06/07, OFF-01…07, AG-02/03/04, INV-02/03, DEMO-01/02/03/05.

---

## 6. Definición de terminado

Una tarea está terminada cuando:
- Cumple su criterio de aceptación **con el sistema real** (no solo con el mock), salvo las marcadas como simuladas.
- Está integrada en `main` y `pnpm dev` sigue funcionando.
- Si mueve dinero: se vio el pago en el Test Wallet.
- Si tiene reglas (GW, GRD, OFF): tiene tests de los casos de rechazo.
- Sus alternativas de respaldo (flags `MOCK_*`) funcionan.

## 7. Checklist del día de la demo

- [ ] `POST /demo/reset` ejecutado y verificado
- [ ] Saldo de Juan suficiente para 3 ejecuciones completas
- [ ] Túnel público activo y la URL de callback actualizada
- [ ] Celulares cargados, PWAs instaladas, modo avión probado
- [ ] Celular de teclas con saldo de SMS (o `/celular` abierto)
- [ ] Video de respaldo abierto en otra pestaña
- [ ] Flags: `MOCK_OP` apagado; los demás según el plan de contingencia
- [ ] Cifras del pitch con su fuente en las diapositivas
