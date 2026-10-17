# Paygent — Poder de pago delegable para personas y sus agentes, incluso sin internet y sin smartphone

**Tagline:** *Juan autoriza una vez. María y sus agentes pagan donde sea — con datos, sin señal o con un celular de teclas.*
**La versión grande:** *Un mandato. Personas y agentes que gastan dentro de él, en cualquier nivel de conectividad. Y cada pago construye historial financiero.*
**Categorías objetivo:** Innovación (Find EAFIT) · Impacto (RutaN) · Inclusión (Puntored)
**Tecnología base:** Open Payments API (Interledger Foundation) — GNAP, Quotes, Incoming/Outgoing Payments
**Backlog de ejecución:** ver [backlog.md](backlog.md)

> **La tesis en una frase:** Open Payments asume que quien paga tiene internet, un smartphone y una billetera propia. Paygent elimina los tres supuestos con **una sola primitiva — el mandato delegable —**, y trata a los **agentes de IA como delegados de primera clase** dentro de ese mismo árbol: el agente se convierte en **el smartphone de quien no lo tiene**.

> **Regla de oro del pitch:** nunca se presenta como "varias features". Siempre es **un mandato → personas y agentes que gastan dentro de él → en cualquier nivel de conectividad**. El domicilio, el cobro por Puntored y el historial no son productos aparte: son el mismo mandato con otra entrega, otro canal de cobro y otra lectura de sus datos.

---

## 1. Elevator pitch (30 segundos)

> Los agentes de IA ya pueden comprar por nosotros, pero solo si tienes smartphone, internet y tarjeta, y en ecosistemas cerrados de Visa, Mastercard o Google. Paygent lleva los pagos agénticos a quien más los necesita, sobre Open Payments, un estándar abierto. Juan, en Texas, aprueba **un solo mandato** en su billetera. Desde ahí su mamá, en una vereda de Antioquia y con un celular de teclas, le escribe por SMS a su agente: *"necesito la pastilla de la presión"*. El agente encuentra la farmacia, le pide su PIN y paga directo desde la wallet de Juan. Si no hay señal, el celular de María firma vales que se cobran al volver la conexión. Un agente guardián vigila cada peso. Nadie retiene el dinero: va una sola vez, de Juan a la tienda. Y cada compra deja un historial que abre la puerta al crédito.

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
- **Escribir también es una barrera:** muchas personas mayores no escriben SMS con fluidez, y una parte de la población rural tiene baja alfabetización *(verificar con DANE)*.
- **Sin historial no hay crédito:** la mamá y el tendero pagan y venden en efectivo, así que para un banco no existen *(verificar inclusión financiera con Banca de las Oportunidades)*.

---

## 3. La innovación

### 3.1 El núcleo: el mandato delegable
Juan aprueba **un grant GNAP real** en su billetera: `outgoing-payment` con `debitAmount` (tope) e `interval` (renovación mensual). El **Mandate Gateway** lo custodia y emite **sub-mandatos firmados** para personas, dispositivos y agentes:

```
Mandato raíz (Juan, USD)                           máx. $300 / mes    ← grant Open Payments real
├── María                                          máx. $250 / mes    mercado, farmacia, efectivo
│   ├── Celular (vale QR)                          con o sin señal · tope offline dinámico (lo ajusta el Guardián)
│   ├── Asistente en su app                        el agente compra por ella · PIN si > $10
│   └── SMS (celular básico)                       el agente atiende sus SMS · PIN siempre
├── Agente Asistente de la mamá                    máx. $40 / semana  farmacia, mercado · PIN si > $10
│   └── Agente de Inventario (agente → agente)     máx. $0.50 / mes   pago por consulta
└── Agente Guardián                                $0 — no gasta: solo puede RESTRINGIR
```

Cada beneficiario queda con esos **tres modos de consumo** al darlo de alta, y Juan los reparte con sliders desde su
panel. La suma de las ramas nunca supera a su padre: si Juan firma un mandato menor, el árbol baja en proporción. Detalle
en [modos-de-consumo.md](modos-de-consumo.md).

### 3.2 Tres niveles de conectividad
| Nivel | Cómo paga | Qué pasa en Open Payments |
|---|---|---|
| **Con datos** | QR en línea | Outgoing Payment inmediato Juan → tendero |
| **Sin señal** | Vale firmado ed25519 en el celular, verificado offline por el tendero | Se liquida al volver la conexión |
| **Celular básico** | SMS + PIN (directo o conversando con su agente) | Outgoing Payment al confirmar el PIN |

### 3.3 Los agentes — dónde aportan algo que un botón no puede

**🗣️ Agente Asistente — "el smartphone de quien no lo tiene"**
- Conversa por **SMS** en lenguaje natural (la voz queda en el roadmap, §3.7): *"necesito losartán"*, *"tráigame la insulina"*, *"¿cuánto me queda este mes?"*.
- Entiende la necesidad, **consulta al Agente de Inventario**, elige comercio (precio, distancia, disponibilidad) y **propone** la compra.
- **Recoger o domicilio:** pregunta *"1 para recogerlo o 2 para enviarlo a casa de María (+$4.000)"*, o lo entiende solo si le dicen *"tráigamela"*. Con domicilio paga **producto + envío en un solo Outgoing Payment** a la tienda, que hace la entrega.
- Paga con su sub-mandato. Si el total (con envío) supera el umbral de **$10**, pide **PIN por SMS** (humano en el bucle).
- Le devuelve un código: para recoger en la tienda, o para darle al domiciliario al recibir.

**🏠 La dirección la pone Juan, no el agente**
- Juan registra en su panel a dónde llegan los pedidos (*casa de María*). Se guarda en el mandato raíz.
- Con domicilio, el **gateway** pone esa dirección en el pago, aunque el agente mande otra: un agente (o un LLM manipulado) **no puede desviar un pedido**. Si un agente intenta cambiar la dirección, recibe 403.
- La tienda ve en su PWA los pedidos ya pagados: qué llevar, a quién, a qué dirección y qué código pedir al entregar.
- **Por qué es IA y no un menú:** una persona mayor con un celular de teclas no va a navegar un menú USSD de 5 niveles, pero sí escribe *"la pastilla de la presión"*.

**📦 Agente de Inventario — economía agente-a-agente con sentido**
- Lo opera la red de comercios (ej. Puntored). Sabe qué tienda tiene qué producto y a qué precio.
- **Cobra un micropago real vía Open Payments por consulta** (ej. $0.01), pagado por el Agente Asistente con su propio sub-mandato.
- Es un dato que Open Payments no da y que alguien produce: el pago agente-a-agente está justificado, no es decorativo.

**🛡️ Agente Guardián — riesgo dinámico para pagos sin conexión**
- Administra el **tope sin señal** de cada celular. El titular fija el **máximo** (lo que acepta perder sin señal, p. ej. $200.000); el celular **arranca en el 40 %** ($80.000) y el Guardián lo **sube un 25 % del máximo** tras compras limpias o lo **baja a la mitad** con cualquier alerta (nunca por debajo del 10 % ni por encima del máximo): *"Subí el tope sin señal de María de $80.000 a $130.000"*.
- Lo hace **solo, cada vez que se liquidan vales** de ese celular. El celular recibe el tope nuevo en su próximo certificado, apenas tiene señal; si lo congelan, deja de firmar vales.
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

### 3.5b El tendero no necesita wallet: cobra directo o por Puntored
No queremos depender de que cada comercio tenga una wallet de Open Payments. El comercio elige cómo cobrar, y puede cambiarlo cuando quiera:

| El tendero… | A dónde va el pago real | Qué recibe |
|---|---|---|
| **Tiene wallet** de Open Payments | Outgoing Payment **directo** de Juan a su wallet | El dinero en su wallet |
| **No tiene wallet** | Outgoing Payment de Juan a la **wallet de Puntored**, con el comercio y su llave Bre-B en el `metadata` | Puntored le acredita por su red: a su **llave Bre-B** (su celular → cualquier banco o billetera) o en su punto |

- **Identidad fija, cobro configurable:** la dirección de cobro del comercio (la que va firmada en los vales) nunca cambia. Si Doña Rosa abre una wallet mañana, cambia cómo cobra y los vales que ya recibió siguen valiendo.
- **Solo el tendero decide** cómo cobra. Un agente que intente cambiarlo recibe 403.
- **Para Puntored:** cada liquidación es una transacción más en su red de ~20.000 corresponsales, y una entrada al ecosistema Interledger.
- **Para Inclusión:** el requisito para recibir pagos baja a *tener un celular con una llave Bre-B*.
- *Honestidad técnica:* para ese tendero, Puntored hace de liquidador (como un adquirente con datáfono). Paygent sigue sin custodiar nada; Puntored ya mueve dinero de terceros como entidad de la red de corresponsales. Hoy Puntored **no** habla Open Payments: esto es una integración que proponemos.

### 3.6 Otros pagadores (fuera del MVP)
La primitiva no depende de quién firma la raíz: el Gateway ya maneja **varios titulares**, cada uno con su wallet y su grant. Un programa de subsidios o una ONG podrían firmar su propio mandato con las mismas reglas. **No lo presentamos en la demo** para no abrir el alcance: queda en el roadmap.

### 3.7 El agente por voz (roadmap, fuera del MVP)
No está construido: el SMS real ya llega por un Android conectado por USB, sin Twilio. Así se haría:

El Asistente atiende **llamadas** además de SMS. La mamá marca un número desde su celular de teclas y dice *"necesito la pastilla de la presión"*.

1. La llamada entra por Twilio Voice; la voz se convierte en texto.
2. El texto entra **al mismo Asistente** que atiende SMS: mismas herramientas, mismas reglas, mismo `/pay`.
3. El agente responde con voz y le pide el PIN **por el teclado del celular** (tonos DTMF). El PIN nunca pasa por el reconocimiento de voz ni por el LLM.
4. Se paga y el código de retiro llega por SMS.

- **Por qué importa:** elimina la barrera de escribir. Sirve para personas mayores y para quien no sabe leer ni escribir.
- **Por qué es IA y no un IVR:** un menú de "marque 1, marque 2" no entiende *"la pasta de la presión, la que me da el doctor"*. El agente sí.
- **Alternativa:** si la voz falla, el mismo agente sigue por SMS o en la vista `/celular`.

### 3.8 Cada pago construye historial financiero
Los vales liquidados, los pagos sin incidentes y el puntaje del Guardián **ya existen**: son un historial de pagos firmado y verificable.

- **Para la mamá:** prueba de que maneja su presupuesto mes a mes.
- **Para el tendero:** meses de ventas firmadas criptográficamente, que hoy son efectivo invisible.
- **Para qué sirve:** un banco o una cooperativa puede usar ese historial para un **primer microcrédito**, sin que nadie tenga que reconstruirlo a mano.
- **Control:** el historial es del titular. Solo se comparte si él lo autoriza.

**Frase para el pitch:** *"Doña Rosa, la tendera, ya tiene seis meses de ventas firmadas. Con eso puede pedir su primer crédito."*

---

## 4. Flujo completo de la demo

1. **Juan** escribe su intención → ve el árbol propuesto → **aprueba una vez en su billetera** (grant interactivo real) → registra la dirección de entrega: *casa de María*.
2. **La mamá (celular de teclas)** le escribe por **SMS real** a su agente: *"necesito la pastilla de la presión"* (alternativa: la vista `/celular` en pantalla).
3. El **Agente Asistente** le paga $0.01 al **Agente de Inventario** (micropago real, visible en el feed) y responde: *"Farmacia San José tiene Losartán a $12.000. Responda 1 para recogerlo o 2 para enviarlo a casa de María (+$4.000)."* Ella responde **2**. El total ($16.000 ≈ $4) está bajo el umbral de $10, así que **el agente lo paga solo**: producto + envío en un **Outgoing Payment real** Juan → farmacia. En la PWA de la farmacia aparece el pedido con la dirección de María. *"Medicinas sin preguntar hasta 10 dólares", como lo pidió Juan.*
4. Luego dice **"tráigame la insulina"** ($85.000 + envío ≈ $22): el agente entiende que es a domicilio y, como supera el umbral, pide el PIN. Ella lo marca → **Outgoing Payment real** → código de entrega. *Humano en el bucle justo donde importa.*
5. **María, en modo avión**, paga el mercado en la Tienda Doña Rosa con un vale QR → el tendero lo verifica sin internet ✓ → reconecta → el **Guardián** revisa el lote → **se liquida en vivo**. Doña Rosa **no tiene wallet**: el pago va a Puntored, que le acredita en su llave Bre-B. *"No le pedimos al tendero nada que no tenga hoy."*
6. **Intento de fraude:** se reenvía el mismo vale → el gateway lo rechaza y el Guardián congela el dispositivo y lo explica en el feed de Juan.
7. **El Guardián sube el tope offline** de María por buen historial (siempre dentro del límite de Juan).
8. **Juan revoca la rama del Asistente** → el siguiente SMS de compra es rechazado. El resto del árbol sigue funcionando.
9. **El tendero abre "Mi historial"**: sus ventas firmadas listas para pedir un microcrédito (10 segundos).

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
| Historial financiero | Outgoing/Incoming Payments reales + vales firmados ed25519 = registro verificable de cada transacción |
| Domicilio | El mismo Outgoing Payment a la tienda por producto + envío; la dirección y el código de entrega van en el registro del pago |
| Tendero sin wallet | Outgoing Payment a la wallet de Puntored con `metadata` { comercio, llave Bre-B }; Puntored liquida al tendero fuera de Open Payments |

**Lo que aportamos y Open Payments no tiene hoy:**
- Delegación con sub-límites para personas **y agentes**.
- Pagos sin conexión con riesgo acotado y ajustado dinámicamente.
- Consentimiento sin navegador.
- Agentes utilizables desde un celular básico, **por SMS**.

---

## 6. Qué es real vs. qué es demo

**Real, en la red de prueba de Interledger (desplegado en Railway, Open Payments real):**
- Grant interactivo con `debitAmount` + `interval` en el Test Wallet, uno por titular (varios titulares con sus beneficiarios, en Postgres)
- Outgoing Payments en todos los flujos, de la wallet del titular a la del comercio
- **Cobro en pesos con el cambio real:** las wallets de los comercios están en **COP** y reciben exactamente su precio; si el titular paga en USD, Open Payments cotiza cuánto le cuesta (el Test Wallet cambia a ~3.180 COP/USD) y con ese débito se deciden el PIN y los topes
- Micropago agente → agente: el Asistente le paga al Inventario cada consulta
- Vales ed25519 sin señal: firma en el celular, verificación offline del tendero y liquidación real al reconectar
- Agente Guardián: reglas deterministas (doble gasto, acumulado, velocidad, comercio nuevo) y **tope sin señal automático** dentro del máximo del titular
- Asistente con Claude (tool use) por SMS; el PIN nunca pasa por el LLM y, si Claude falla, responden las reglas
- **SMS real** desde un celular de teclas, por un Android conectado por USB (puente `adb`)
- **Precios en internet en vivo** de 7 cadenas colombianas (catálogos públicos) y **sucursales reales más cercanas** a la persona (OpenStreetMap)
- Domicilio a la dirección que fija el titular (producto + envío en un solo pago) y cobro directo o por Puntored según el comercio

**Simulado:**
- **Las tiendas de la vereda** (catálogo del Agente de Inventario): productos, precios y stock sintéticos. La consulta y la compra **sí se pagan de verdad**
- La acreditación final de Puntored al tendero sin wallet (el pago a la wallet de Puntored sí es real)
- La entrega física del domicilio
- Las explicaciones del Guardián son plantillas (sus decisiones son reglas reales)

**Fuera del MVP:** voz, otros pagadores (Estado / ONG), historial financiero para crédito.

**Frase para el pitch:** *"Todo lo que mueve dinero es real sobre la red de prueba de Interledger, y los precios y las tiendas cercanas son datos reales en vivo. Lo único simulado son las tiendas de la vereda y la acreditación final de Puntored."*

---

## 7. Arquitectura

```
src/web/     (React + Vite, PWA)   → /juan  /maria  /tendero  /celular (simulado)
src/api/     (Node + TypeScript)   → Open Payments SDK, Mandate Gateway, /pay, vales, SMS webhook
src/agents/  (Python + FastAPI)    → Asistente (Claude tool use), Inventario, Guardián, Intención
src/shared/  (TypeScript)          → tipos, verificación ed25519 de vales (la usan web y api)
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
- **"¿Y si Juan firma un mandato menor del que ya repartió?"** → Al volver de su billetera, el árbol se ajusta solo, en proporción y en cascada: solo baja lo que no cabe. La suma de las ramas nunca supera lo firmado, y queda en la libreta.
- **"¿Paygent sabe cuánto dinero tiene Juan?"** → No: Open Payments no expone saldos, y los topes son permisos, no dinero reservado. Si la wallet no tiene fondos, el pago lo rechaza la propia billetera y no se mueve nada.
- **"¿Qué pasa si Juan no tiene saldo al liquidar un vale offline?"** → Es el riesgo residual. En producción haría falta una reserva de fondos, que Open Payments no tiene hoy: es parte de nuestra propuesta.
- **"¿Por qué no Visa, Mastercard o AP2?"** → Son cerrados y asumen smartphone, internet y tarjeta.
- **"¿No están haciendo varios productos: pagos, domicilios y crédito?"** → No. Es un solo mandato; el código es el mismo. El historial no es un producto nuevo: son los datos que el mandato ya produce.
- **"¿Y si el agente (o alguien que lo engañe) manda el pedido a otra dirección?"** → No puede. La dirección la registra Juan en el mandato raíz y el gateway la pone en cada pago, ignorando la que mande el agente. Si un agente intenta cambiarla, recibe un 403. Está probado en los tests.
- **"¿Y si el tendero no tiene wallet de Open Payments?"** → Cobra por Puntored a su llave Bre-B, que es su celular. El pago de Juan va real a la wallet de Puntored y Puntored le acredita por su red, como ya hace hoy con sus corresponsales. Si un día abre una wallet, cambia cómo cobra y sus vales siguen valiendo.
- **"Entonces Puntored sí retiene el dinero."** → Solo para el tendero que no tiene wallet, y hace lo que ya hace hoy: liquidar a su red. Paygent no custodia nada. El tendero con wallet recibe directo de Juan.
- **"¿Quién es dueño del historial?"** → El titular. Se comparte solo si él lo autoriza, y cada registro está firmado, así que nadie lo puede alterar.

---

## 9. Roadmap (fuera del MVP)

- Agente Asistente por **USSD** y voz en lenguas indígenas
- Pilotos con un pagador institucional (programa de subsidios u ONG) sobre la red de Puntored
- Historial financiero portable: compartirlo con bancos y cooperativas con consentimiento del titular
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
- Claude API (tool use) · tweetnacl / WebCrypto (ed25519) · SMS por Android (`adb`) · OpenStreetMap (Overpass)
