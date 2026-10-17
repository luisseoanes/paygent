# Declaración de uso de IA

<!-- TODO: completar lo marcado con [COMPLETAR] (lo de cada miembro del equipo) antes de la entrega. No dejar ninguna marca. -->

## Herramientas utilizadas

* Claude Code (Claude Opus 5.5)
* [COMPLETAR: resto de herramientas del equipo y modelo, p. ej. ChatGPT (GPT-…), Copilot, Cursor]

## Dónde y cómo usamos la IA

Lo hecho en las sesiones de Claude Code de Pedro está detallado abajo, con sus ficheros; sus prompts literales están en
[`/prompts`](prompts/). Cada miembro completa lo suyo.

### 1. Backend – Flujo de Open Payments (`src/api/src/op/`)

* Claude Code (sesiones de Pedro): grant raíz con rotación del token ante `403 Inactive Token`, espera a que el pago
  llegue y cierre del incoming payment del comercio, moneda de la wallet del titular (`asset.ts`), y el ajuste
  proporcional del árbol cuando el titular firma un grant menor (`routes.ts`). Ficheros: `client.ts`, `grants.ts`,
  `settle.ts`, `asset.ts`, `routes.ts` y `src/api/scripts/op-smoke.ts`.
* Cada llamada al SDK se comprobó contra `@interledger/open-payments` 7.4.0 y se probó con `pnpm op:smoke` contra el
  Test Wallet (`MOCK_OP=0`); los pagos se verificaron viendo el saldo en las wallets.
* [COMPLETAR: lo hecho por el resto del equipo en `op/` y con qué herramienta]

### 2. Backend – Mandate Gateway, persistencia y vales (`src/api/src/gateway/`, `store/`, `auth/`, `vouchers/`, `src/shared/`)

* Claude Code (sesiones de Pedro):
  * Persistencia en Postgres (PGlite en local y tests) con migraciones versionadas: `store/migrations.ts`, `store/sql.ts`,
    `store/legacy.ts`, `db.ts`, `demo/seed.ts`.
  * Cuentas (titulares y beneficiarios), varios titulares con su propio mandato raíz y alta de beneficiarios:
    `auth/routes.ts`, `gateway/routes.ts`.
  * Modos de consumo del beneficiario (celular, Asistente, SMS), reparto de topes atómico y bloqueo del padre para que
    la suma de los hijos nunca supere al padre: `gateway/modes.ts`, `gateway/mandates.ts`, `gateway/phone.ts`, ajustes
    en `gateway/sms-canal.ts`; columna `mode` en `src/shared/src/types.ts`.
  * Chat de la app con su propio Asistente (`chat/routes.ts`) y vales por SMS sobre Postgres (`sms/vale.ts`).
  * Tests en `src/api/test/` (entre otros `modes.test.ts`, `grant-menor.test.ts`, `varios-beneficiarios.test.ts`,
    `multi-payer.test.ts`). Cada corrección lleva un test que falla sin ella.
* [COMPLETAR: lo hecho por el resto del equipo en el gateway, los vales y `src/shared/`, y con qué herramienta]

### 3. Agentes (`src/agents/`)

* Claude Code (sesiones de Pedro): el PIN de 4 a 6 dígitos se intercepta antes del LLM (`assistant/router.py`), el
  Asistente paga en la moneda del árbol de quien escribe (`assistant/tools.py`), cliente de la api y comercios
  (`common/`) e inventario (`inventory/`), con sus tests en `tests/test_assistant.py`.
* [COMPLETAR: el servicio FastAPI, el Asistente con *tool use*, el Inventario, el Guardián y el compilador de intención:
  quién y con qué herramienta]

### 4. Frontend – PWA (`src/web/src/`)

* Claude Code (sesiones de Pedro): alta de beneficiario y enlace de cuentas (`features/mandates/components/delegar-rama.tsx`,
  `api/register-beneficiary.ts`), formas de pagar y el modal de reparto de topes con sliders
  (`modos-de-consumo.tsx`, `repartir-modos.tsx`, `api/modes.ts`, `config/modos.ts`,
  `features/billetera/components/formas-de-pagar.tsx`), recuperación tras un despliegue y cierre de sesión
  (`components/errors/route-error.tsx`, `lib/version.ts`, `lib/auth.tsx`), simulador SMS por número
  (`app/routes/celular.tsx`), mocks MSW y tests de integración.
* El modal de reparto y la recuperación tras un despliegue se revisaron en un build de producción, en escritorio y móvil.
* [COMPLETAR: el resto de vistas y componentes: quién y con qué herramienta]

### 5. Documentación

* `AI_USAGE.md`: estructura y redacción con Claude Code, a partir de la plantilla de la organización del hackatón.
* Claude Code (sesiones de Pedro): `README.md`, `CLAUDE.md`, `src/web/CLAUDE.md`, `docs/api/`, `docs/operacion/`,
  `docs/open-payments/test-wallet.md`, `docs/producto/modos-de-consumo.md` y el registro de `prompts/`. Revisado por Pedro.
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
  habilitados al darlo de alta y el reparto de topes con sliders y tope total.
* [COMPLETAR: decisiones de diseño del resto del equipo: el mandato delegable, las reglas de los agentes, el modelo de vales offline, el guion de la demo…]
* Ficheros hechos con poca o ninguna IA: [COMPLETAR: lista de rutas].

## Registro de prompts

La carpeta [`/prompts`](prompts/) contiene el texto literal de los prompts de programación, un fichero por sesión de
Claude Code con las áreas que toca (índice en [`prompts/README.md`](prompts/README.md)). Los datos personales y de
autorización están sustituidos por `[…]`.
