# Declaración de uso de IA

<!-- TODO: completar lo marcado con [COMPLETAR] (lo de cada miembro del equipo) antes de la entrega. No dejar ninguna marca. -->

## Herramientas utilizadas

* Claude Code (Claude Opus 5.5)
* [COMPLETAR: resto de herramientas del equipo y modelo, p. ej. ChatGPT (GPT-…), Copilot, Cursor]

## Dónde y cómo usamos la IA

Lo hecho en las sesiones de Claude Code de Pedro (S1–S6, fechas en [`prompts/README.md`](prompts/README.md)) está
detallado abajo, con sus ficheros; sus prompts literales están en [`/prompts`](prompts/). Cada miembro completa lo suyo.

### 1. Backend – Flujo de Open Payments (`src/api/src/op/`)

* Claude Code (S1–S3): grant raíz con rotación del token ante `403 Inactive Token`, espera a que el pago llegue y cierre
  del incoming payment del comercio, moneda de la wallet del titular (`src/api/src/demo/asset.ts`), y el ajuste
  proporcional del árbol cuando el titular firma un grant menor (`gateway/routes/root-grant.ts`, `gateway/root.ts`).
  Ficheros: `op/client.ts`, `op/grants.ts`, `op/settle.ts` y `src/api/scripts/op-smoke.ts`.
* Las llamadas al SDK de S1 se comprobaron contra `@interledger/open-payments` 7.4.0 y se probaron con `pnpm op:smoke`
  contra el Test Wallet (`MOCK_OP=0`); los pagos se verificaron viendo el saldo en las wallets.
* Claude Code (S4): Open Payments queda como adaptador (`op/` no importa el dominio) y la moneda de la demo sale
  del núcleo a `src/api/src/demo/asset.ts`.
* Claude Code (S5): si `settle` reintenta tras rotar un token vencido, devuelve la primera reserva y cierra el primer
  incoming payment (`op/settle.ts`, `gateway/pay.ts`; tests `op-settle-reintento.test.ts` y
  `pay-reintento-token.test.ts`). Probado con el cliente de Open Payments simulado, no contra el Test Wallet.
* [COMPLETAR: lo hecho por el resto del equipo en `op/` y con qué herramienta]

### 2. Backend – Mandate Gateway, persistencia y vales (`src/api/src/gateway/`, `store/`, `auth/`, `vouchers/`, `src/shared/`)

* Claude Code (S1–S3):
  * Persistencia en Postgres (PGlite en local y tests) con migraciones versionadas: `store/migrations.ts`, `store/sql.ts`,
    los repositorios `store/*.ts` y `demo/seed.ts`.
  * Cuentas (titulares y beneficiarios), varios titulares con su propio mandato raíz y alta de beneficiarios:
    `auth/routes.ts`, `gateway/routes/`.
  * Modos de consumo del beneficiario (celular, Asistente, SMS), reparto de topes atómico y bloqueo del padre para que
    la suma de los hijos nunca supere al padre: `gateway/modes.ts`, `gateway/mandates.ts`, `gateway/phone.ts`, ajustes
    en `gateway/sms-canal.ts`; columna `mode` en `src/shared/src/types.ts`.
  * Chat de la app con su propio Asistente (`chat/routes.ts`) y vales por SMS sobre Postgres (`sms/vale.ts`).
  * Tests en `src/api/test/` (entre otros `modes.test.ts`, `grant-menor.test.ts`, `varios-beneficiarios.test.ts`,
    `multi-payer.test.ts`). Cada corrección lleva un test que falla sin ella.
* Claude Code (S4, arquitectura):
  * Capas rutas → casos de uso → reglas → repositorios y adaptadores, vigiladas por `test/arquitectura.test.ts`:
    repositorios por agregado en `store/*.ts` (sustituyen a `db.ts`), rutas partidas por recurso en
    `gateway/routes/` y esquemas de cuerpo en `http/schemas.ts`.
  * Sesión firmada (HMAC) y una guardia en cada ruta: `auth/session.ts`, `auth/guards.ts`, `test/auth.test.ts`.
  * El gasto se reserva bajo bloqueo antes de pagar (`gateway/spend.ts`; `pay-concurrente.test.ts`,
    `pay-reserva-falla.test.ts`), y una raíz revocada que se vuelve a firmar arranca vacía (`gateway/root.ts`).
  * Caja del tendero con lo cobrado por su comercio (`merchants/`, `store/payments.ts`; `merchant-payments.test.ts`),
    un tendero de demo por comercio (`demo/seed.ts`) y enlace del celular con código antes de tener cuenta
    (`auth/guards.ts`, `gateway/routes/mandates.ts`).
* Claude Code (S5, auditoría del código y correcciones):
  * Todas las escrituras de mandatos bloquean la fila antes de leerla (`gateway/mandates.ts`, `gateway/root.ts`,
    `gateway/modes.ts`; `mandato-escritura-concurrente.test.ts`).
  * Lo que suma un certificado de vales no pasa de su tope y la fecha del vale cae dentro del certificado
    (`vouchers/settle.ts`, `store/offline.ts`; `vale-tope-cert.test.ts`).
  * Una confirmación de PIN paga una sola vez (`gateway/pin.ts`, `pay-pin-doble.test.ts`), el login se frena tras
    5 fallos (`auth/limiter.ts`), el token no sale en los logs (`http/log.ts`), un 500 responde con id de error
    (`app.ts`) y un monto en otra moneda se rechaza (razón `currency` en `src/shared/src/types.ts`, `monedas.test.ts`).
  * Fuera código muerto: `store/legacy.ts` y la ruta `/callback` sin `rootId`, entre otros.
  * Los tests de regresión se ejecutaron también sobre el código anterior y fallan allí, salvo los casos de control.
* Claude Code (S6): CI con typecheck y todos los tests en cada push (`.github/workflows/ci.yml`, verificado en un clon
  limpio con Node 22), medición de cobertura y un test del feed en vivo: un titular no recibe los eventos de otro árbol
  (`test/feed-stream.test.ts`, que falla si se quita el filtro). Sección *Quality* del `README.md`.
* [COMPLETAR: lo hecho por el resto del equipo en el gateway, los vales y `src/shared/`, y con qué herramienta]

### 3. Agentes (`src/agents/`)

* Claude Code (S1–S3): el PIN de 4 a 6 dígitos se intercepta antes del LLM (`assistant/router.py`), el
  Asistente paga en la moneda del árbol de quien escribe (`assistant/tools.py`), cliente de la api y comercios
  (`common/`) e inventario (`inventory/`), con sus tests en `tests/test_assistant.py`.
* Claude Code (S5): el PIN se intercepta también dentro de una frase («mi pin es 1234», «Clave: 1234»), y si hay una
  compra esperando PIN, los dígitos llegan tapados al LLM (`assistant/router.py`, `tests/test_assistant.py`).
  Se quitó código sin uso (`web_offers`).
* [COMPLETAR: el servicio FastAPI, el Asistente con *tool use*, el Inventario, el Guardián y el compilador de intención:
  quién y con qué herramienta]

### 4. Frontend – PWA (`src/web/src/`)

* Claude Code (S1–S3): alta de beneficiario y enlace de cuentas (`features/mandates/components/delegar-rama.tsx`,
  `api/register-beneficiary.ts`), formas de pagar y el modal de reparto de topes con sliders
  (`modos-de-consumo.tsx`, `repartir-modos.tsx`, `api/modes.ts`, `config/modos.ts`,
  `features/billetera/components/formas-de-pagar.tsx`), recuperación tras un despliegue y cierre de sesión
  (`components/errors/route-error.tsx`, `lib/version.ts`, `lib/auth.tsx`), simulador SMS por número
  (`app/routes/celular.tsx`), mocks MSW y tests de integración.
* El modal de reparto y la recuperación tras un despliegue se revisaron en un build de producción, en escritorio y móvil.
* Claude Code (S4): token de sesión en cada petición (`lib/session.ts`, `lib/api-client.ts`, `lib/auth.tsx`); caja
  del tendero con historial de cobros (`features/cobro/components/caja.tsx`, `features/cobro/api/get-cobros.ts`) y
  un botón de demo por comercio en el login (`config/demo-users.ts`, `features/auth/components/login-form.tsx`); una
  rama revocada sale de la lista de delegados (`delegados.tsx`); desde el vale se vuelve a la billetera o se hace
  otro pago (`features/billetera/components/vale-qr.tsx`, revisado en Chrome a 390×844); el techo sin señal y lo que
  hoy se puede gastar sin señal se muestran por separado (`inicio-billetera.tsx`, `modos-de-consumo.tsx`,
  `repartir-modos.tsx`).
* Claude Code (S5): borrado de código muerto (10 componentes sin uso, entre ellos badge, card, pagination y
  delegate-mandate, además de `useT9` y helpers de la landing) y del `src/web/package-lock.json` sobrante.
* [COMPLETAR: el resto de vistas y componentes: quién y con qué herramienta]

### 5. Documentación

* `AI_USAGE.md`: estructura y redacción con Claude Code, a partir de la plantilla de la organización del hackatón.
* Claude Code (S1–S3): `README.md`, `CLAUDE.md`, `src/web/CLAUDE.md`, `docs/api/`, `docs/operacion/`,
  `docs/open-payments/test-wallet.md` y `docs/producto/modos-de-consumo.md`. Revisado por Pedro.
* Claude Code (S4): `docs/arquitectura.md` (capas, camino del dinero, seguridad, decisiones), la matriz de permisos
  en `docs/api/endpoints.md`, `docs/operacion/sms.md`, `src/web/README.md` y, en el sitio público,
  `site-docs/architecture.md`, `security.md` y `api-reference.md`. S5: compromisos conocidos y riesgos al día en
  `docs/arquitectura.md` y `site-docs/security.md`. El registro de `prompts/` (S6), por área de trabajo.
* [COMPLETAR: `docs/producto/context.md`, `docs/producto/backlog.md` y el resto: con qué herramienta y cuánto se editó a mano]

## IA dentro del producto (no como herramienta de desarrollo)

Paygent llama a la API de Claude en tiempo de ejecución. Esto es parte de la solución, no código generado:

* `src/agents/assistant/llm.py`: el Agente Asistente usa Claude con *tool use* para entender el SMS y proponer la compra. Todas sus acciones pasan por `/pay`, que aplica el sub-mandato y el PIN.
* `src/agents/intent/compiler.py`: convierte la intención de Juan en texto libre en el árbol de mandatos que él aprueba.
* Si no hay `ANTHROPIC_API_KEY` o el modelo falla, ambos usan reglas deterministas (`MOCK_LLM=1`).

## Lo que hicimos nosotros

* Probar y verificar todo el código sugerido por la IA, en especial el que mueve dinero: ningún pago se dio por bueno sin verlo en el Test Wallet.
* Decisiones de diseño de Pedro (ver sus prompts): separar cuentas que delegan de cuentas que solo reciben, no guardar
  nunca la llave privada de quien delega (wallet + grant), agentes como filas con una sola credencial del servicio, el
  flujo de alta del beneficiario (alias, tope, PIN y tope sin señal; código para enlazar), los modos de consumo
  habilitados al darlo de alta y el reparto de topes con sliders y tope total, reorganizar el backend por capas antes
  de la entrega empezando por la autenticación, un tendero de demo por comercio en lugar de uno con selector, resolver
  el techo sin señal con claridad en la interfaz sin cambiar la regla, y elegir qué hallazgos de la auditoría se
  arreglaban y cuáles quedaban como compromiso conocido.
* [COMPLETAR: decisiones de diseño del resto del equipo: el mandato delegable, las reglas de los agentes, el modelo de vales offline, el guion de la demo…]
* Ficheros hechos con poca o ninguna IA: los retoques de texto de la portada que Pedro hizo a mano (commit `71fe3a0`:
  `features/marketing/components/hero-paisaje.tsx`, `problema.tsx` y `sin-senal.tsx`); [COMPLETAR: resto del equipo].

## Registro de prompts

La carpeta [`/prompts`](prompts/) contiene el texto literal de los prompts de programación, un fichero por área de
trabajo (índice en [`prompts/README.md`](prompts/README.md)). Los datos personales y de
autorización están sustituidos por `[…]`.
