# OpenRoute — Poder de pago delegable para personas y sus agentes, incluso sin internet y sin smartphone

**Tagline:** *Juan autoriza una vez. María y sus agentes pagan donde sea — con datos, sin señal o con un celular de teclas.*
**Categorías objetivo:** Innovación (Find EAFIT) · Impacto (RutaN) · Inclusión (Puntored)
**Tecnología base:** Open Payments API (Interledger Foundation) — GNAP, Quotes, Incoming/Outgoing Payments
**Backlog de ejecución:** ver [backlog.md](backlog.md)

> **La tesis en una frase:** Open Payments asume que quien paga tiene internet, un smartphone y una billetera propia. OpenRoute elimina los tres supuestos con **una sola primitiva — el mandato delegable —**, y trata a los **agentes de IA como delegados de primera clase** dentro de ese mismo árbol: el agente se convierte en **el smartphone de quien no lo tiene**.

> **Regla de oro del pitch:** nunca se presenta como "varias features". Siempre es **un mandato → personas y agentes que gastan dentro de él → en cualquier nivel de conectividad**.

---

## 1. Elevator pitch (30 segundos)

> Los agentes de IA ya pueden comprar por nosotros, pero solo si tienes smartphone, internet y tarjeta, y en ecosistemas cerrados de Visa, Mastercard o Google. OpenRoute lleva los pagos agénticos a quien más los necesita, sobre Open Payments, un estándar abierto. Juan, en Texas, aprueba **un solo mandato** en su billetera. Desde ahí su mamá, en una vereda de Antioquia y con un celular de teclas, le escribe por SMS a su agente: *"necesito la pastilla de la presión"*. El agente encuentra la farmacia, le pregunta su PIN y paga directo desde la wallet de Juan. Si no hay señal, el celular de María firma vales que se cobran al volver la conexión. Y un agente guardián vigila cada peso. Nadie retiene el dinero: va una sola vez, de Juan a la tienda.

---

## 2. El problema

- **Remesas caras e indirectas:** el dinero cambia de manos varias veces antes de ser útil *(verificar cifras con Remittance Prices Worldwide del Banco Mundial)*.
- **La última milla es la conectividad y el dispositivo:** en zonas rurales hay señal intermitente o solo SMS, y muchas personas mayores usan celulares básicos *(verificar con MinTIC / DANE)*.
- **Open Payments hoy excluye a esas personas:**
  - Cada pago exige estar en línea.
  - El consentimiento es solo por redirección web.
  - Solo paga quien tiene su propia billetera.
- **Los pagos agénticos actuales** (Mastercard Agent Pay, Visa Intelligent Commerce, Google AP2):
  - Son cerrados.
  - Asumen smartphone, internet y tarjeta.
  - Dejan por fuera justo a quien más se beneficiaría de un asistente.

---

## 3. La innovación

### 3.1 El núcleo: el mandato delegable
Juan aprueba **un grant GNAP real** en su billetera: `outgoing-payment` con `debitAmount` (tope) e `interval` (renovación mensual). El **Mandate Gateway** lo custodia y emite **sub-mandatos firmados** para personas, dispositivos y agentes:

```
Mandato raíz (Juan, USD)                           máx. $300 / mes    ← grant Open Payments real
├── María                                          máx. $250 / mes    mercado, farmacia, efectivo
│   ├── Llave de dispositivo (sin señal)           tope offline dinámico (lo ajusta el Guardián)
│   └── PIN SMS (celular básico)                   máx. $50 por compra
├── Agente Asistente de la mamá                    máx. $40 / semana  farmacia, mercado · PIN si > $10
│   └── Agente de Inventario (agente → agente)     máx. $0.50 / mes   pago por consulta
└── Agente Guardián                                $0 — no gasta: solo puede RESTRINGIR
```

### 3.2 Tres niveles de conectividad
| Nivel | Cómo paga | Qué pasa en Open Payments |
|---|---|---|
| **Con datos** | QR en línea | Outgoing Payment inmediato Juan → tendero |
| **Sin señal** | Vale firmado ed25519 en el celular, verificado offline por el tendero | Se liquida al volver la conexión |
| **Celular básico** | SMS + PIN (directo o conversando con su agente) | Outgoing Payment al confirmar el PIN |

### 3.3 Los agentes — dónde aportan algo que un botón no puede

**🗣️ Agente Asistente — "el smartphone de quien no lo tiene"**
- Conversa por **SMS** (roadmap: voz) en lenguaje natural: *"necesito losartán"*, *"¿cuánto me queda este mes?"*, *"mándame 50 mil en efectivo"*.
- Entiende la necesidad, **consulta al Agente de Inventario**, elige comercio (precio, distancia, disponibilidad) y **propone** la compra.
- Paga con su sub-mandato. Si la compra supera el umbral, pide **PIN por SMS** (humano en el bucle).
- Le devuelve a la mamá un código de retiro para recoger el producto.
- **Por qué es IA y no un menú:** una persona mayor con un celular de teclas no va a navegar un menú USSD de 5 niveles, pero sí escribe *"la pastilla de la presión"*.

**📦 Agente de Inventario — economía agente-a-agente con sentido**
- Lo opera la red de comercios (ej. Puntored). Sabe qué tienda tiene qué producto y a qué precio.
- **Cobra un micropago real vía Open Payments por consulta** (ej. $0.01), pagado por el Agente Asistente con su propio sub-mandato.
- Es un dato que Open Payments no da y que alguien produce: el pago agente-a-agente está justificado, no es decorativo.

**🛡️ Agente Guardián — riesgo dinámico para pagos sin conexión**
- Ajusta el **tope offline** de cada dispositivo según el historial (compras liquidadas sin problemas, zona con poca señal, comercios de confianza): *"María: $20 → $35"*.
- Revisa los lotes de vales antes de liquidarlos, detecta patrones raros y puede **congelar** un sub-mandato.
- **Invariante clave:** el Guardián **solo puede restringir, nunca ampliar** más allá de lo que Juan autorizó. Todo cambio sube al feed de Juan con su explicación.
- *Honestidad técnica:* las decisiones son reglas deterministas. El LLM solo redacta la explicación legible. No usamos IA donde una regla basta.

**🧭 Compilador de intención (del lado de Juan)**
- Juan escribe *"hasta 300 dólares al mes para mi mamá y María; medicinas sin preguntar hasta 10 dólares"*, y el LLM genera el grant raíz y el árbol.
- Juan ve un resumen y aprueba en su billetera. El LLM redacta; la billetera de Juan autoriza.

### 3.4 Las 5 reglas de los agentes
1. **Un agente es una hoja del árbol:** nunca gasta más que su sub-mandato, y el gateway lo hace cumplir, no el modelo.
2. **Monotonía:** ningún agente puede ampliar un permiso, solo restringirlo.
3. **Humano en el bucle:** por encima del umbral, el agente pide PIN.
4. **No custodial:** todo pago de un agente es un Outgoing Payment real de la wallet de Juan al destinatario final. Ningún agente retiene fondos.
5. **Trazabilidad:** cada acción del agente aparece en el feed de Juan con su "por qué", y Juan puede revocar cualquier rama del árbol.

### 3.5 Retiro de efectivo sin código extra
Un punto Puntored "vende efectivo": retirar es una compra más en la categoría `efectivo`. Mismo flujo para personas y agentes.

---

## 4. Flujo completo de la demo

1. **Juan** escribe su intención → ve el árbol propuesto → **aprueba una vez en su billetera** (grant interactivo real).
2. **La mamá (celular de teclas)** manda un SMS: *"necesito la pastilla de la presión"*.
3. El **Agente Asistente** le paga $0.01 al **Agente de Inventario** (micropago real, visible en el feed) → responde: *"Farmacia San José la tiene a $12.000, a 3 cuadras. Responde con tu PIN para pagar."*
4. Ella responde el PIN → **Outgoing Payment real** Juan → farmacia → llega el SMS con el código de retiro.
5. **María, en modo avión**, paga el mercado con un vale QR → el tendero lo verifica sin internet ✓ → reconecta → el **Guardián** revisa el lote → **se liquida en vivo**.
6. **Intento de fraude:** se reenvía el mismo vale → el gateway lo rechaza y el Guardián congela el dispositivo y lo explica en el feed de Juan.
7. **El Guardián sube el tope offline** de María por buen historial (siempre dentro del límite de Juan).
8. **Juan revoca la rama del Asistente** → el siguiente SMS de compra es rechazado. El resto del árbol sigue funcionando.

---

## 5. Cómo usa Open Payments cada pieza

| Pieza | Mecanismo de Open Payments |
|---|---|
| Mandato raíz | Grant GNAP interactivo `outgoing-payment` con `limits.debitAmount` + `limits.interval` |
| Consentimiento de Juan | `interact.redirect` → billetera → continuación del grant con `interact_ref` |
| Cobro de comercios y del Agente de Inventario | Grant no interactivo `incoming-payment` + Incoming Payment con `incomingAmount` y `metadata` |
| Conversión USD → moneda local | **Quote** real desde la wallet de Juan |
| Todo pago (personas, dispositivos, agentes) | **Outgoing Payment** de la wallet de Juan al destinatario final, bajo el grant raíz |
| Identidad de agentes y comercios | Wallet address + llaves (JWKS) + firmas HTTP |
| Revocación | Revocar el grant en el servidor de autorización (todo el árbol) o una rama en el gateway |
| Seguimiento | Estado de pagos (`receivedAmount`, `sentAmount`, `failed`) |

**Lo que aportamos y Open Payments no tiene hoy:**
- Delegación con sub-límites para personas **y agentes**.
- Pagos sin conexión con riesgo acotado y ajustado dinámicamente.
- Consentimiento sin navegador.
- Agentes utilizables desde un celular básico.

---

## 6. Qué es real vs. qué es demo

**Real (no negociable):**
- Grant interactivo con `debitAmount` + `interval` en el Test Wallet
- Mandate Gateway con sub-mandatos firmados, reglas de agentes y revocación por rama
- Vales offline firmados, verificación offline y liquidación real
- Agente Asistente con LLM que propone la compra; el pago real se hace tras el PIN
- Micropago real Agente Asistente → Agente de Inventario
- Outgoing Payments reales en todos los flujos

**Real si alcanza, simulado si no:**
- SMS por Twilio hacia un celular de teclas real → si no, un celular simulado en pantalla
- Explicaciones del Guardián con LLM → si no, texto de plantilla

**Simulado:**
- Catálogo del Agente de Inventario (datos sintéticos; **el pago por consultarlo es real**)
- COP si el Test Wallet no lo soporta
- Renovación mensual con un intervalo corto

**Frase para el pitch:** *"Todo lo que mueve dinero es real sobre la red de prueba de Interledger. Lo que simulamos es la red celular y el inventario de las tiendas."*

---

## 7. Arquitectura

```
apps/web     (React + Vite, PWA)   → /juan  /maria  /tendero  /celular (simulado)
apps/api     (Node + TypeScript)   → Open Payments SDK, Mandate Gateway, /pay, vales, SMS webhook
agents/      (Python + FastAPI)    → Asistente (Claude tool use), Inventario, Guardián, Intención
packages/shared (TypeScript)       → tipos, verificación ed25519 de vales (la usan web y api)
```

La especificación de entidades, endpoints y tareas está en [backlog.md](backlog.md).

---

## 8. Preguntas del jurado (respuestas listas)

- **"¿Qué impide que el agente gaste de más o alucine un pago?"** → El agente no tiene acceso directo al dinero: todo pasa por `/pay`, que aplica el tope del sub-mandato, las categorías y el PIN. El modelo propone; el gateway decide; la billetera de Juan fija el límite máximo.
- **"¿Por qué el Guardián es IA?"** → Sus decisiones son reglas deterministas; la IA solo explica. Y el Guardián solo puede restringir, nunca ampliar.
- **"¿Por qué pagarle a un agente de inventario?"** → Porque alguien produce ese dato. Es el modelo de negocio de la red de comercios, y demuestra pagos agente-a-agente sobre un estándar abierto.
- **"¿Y el doble gasto offline?"** → Acotado por el tope offline, igual que los límites de las tarjetas sin conexión. El Guardián lo ajusta por riesgo y detecta anomalías al liquidar.
- **"¿El SMS reemplaza el consentimiento de Open Payments?"** → No. Juan dio el consentimiento real en su billetera; el SMS aprueba gastos dentro de ese permiso. Llevarlo al servidor de autorización (GNAP `user_code`) es nuestra propuesta de extensión.
- **"¿Quién tiene el dinero?"** → Nadie en el medio. Cada pago va de la wallet de Juan al destinatario final.
- **"¿Qué pasa si Juan no tiene saldo al liquidar un vale offline?"** → Es el riesgo residual. En producción haría falta una reserva de fondos, que Open Payments no tiene hoy: es parte de nuestra propuesta.
- **"¿Por qué no Visa, Mastercard o AP2?"** → Son cerrados y asumen smartphone, internet y tarjeta.

---

## 9. Roadmap (fuera del MVP)

- Agente Asistente por **voz** y **USSD**
- Consentimiento sin navegador nativo en el servidor de autorización (GNAP `user_code`, proveedor de identidad propio en Rafiki)
- Delegación nativa de grants: propuesta a la comunidad de Open Payments
- Reserva de fondos para liquidar vales offline sin riesgo de saldo
- **Agente del tendero:** paga a su proveedor con lo que vende, con su propio mandato
- Mercado abierto de agentes: cualquiera registra un agente y cobra por uso
- KYC/AML real, disputas, reputación de agentes y comercios

---

## 10. Recursos

- https://openpayments.dev — grants, `limits`, `interval`, quotes, incoming y outgoing payments
- https://github.com/interledger/open-payments-specifications — especificaciones OpenAPI
- Node SDK `@interledger/open-payments` + Open Payments Node SDK Snippets
- Interledger Test Wallet · Bruno Collections · Rafiki (https://github.com/interledger/rafiki)
- GNAP: RFC 9635 (modos de interacción `redirect`, `user_code`)
- Claude API (tool use) · tweetnacl / WebCrypto (ed25519) · Twilio SMS
