# Declaración de uso de IA

<!-- TODO: completar lo marcado con [COMPLETAR] antes de la entrega. No dejar ninguna marca. -->

## Herramientas utilizadas

* Claude Code (Claude Opus 5.5)
* [COMPLETAR: resto de herramientas del equipo y modelo, p. ej. ChatGPT (GPT-…), Copilot, Cursor]

## Dónde y cómo usamos la IA

### 1. Backend – Flujo de Open Payments (`src/api/src/op/`)

Ficheros: `client.ts`, `grants.ts`, `settle.ts`, `routes.ts` y el script `src/api/scripts/op-smoke.ts`.

* [COMPLETAR: herramienta] para [COMPLETAR: qué generó, p. ej. el andamiaje del grant interactivo, el incoming payment, el quote y el outgoing payment].
* [COMPLETAR: qué revisamos o reescribimos a mano y por qué]. Cada llamada al SDK se comprobó contra `@interledger/open-payments` 7.4.0 y se probó con `pnpm op:smoke` contra el Test Wallet (`MOCK_OP=0`).

### 2. Backend – Mandate Gateway y vales offline (`src/api/src/gateway/`, `src/api/src/vouchers/`, `src/shared/`)

* [COMPLETAR: herramienta] para [COMPLETAR: p. ej. la verificación de límites de los sub-mandatos, la firma ed25519 de vales y sus tests].
* [COMPLETAR: qué se revisó o reescribió a mano].

### 3. Agentes (`src/agents/`)

* [COMPLETAR: herramienta] para [COMPLETAR: p. ej. el servicio FastAPI, el Asistente con *tool use*, el Inventario, el Guardián, el compilador de intención y los tests de `src/agents/tests/`].
* [COMPLETAR: qué se revisó o reescribió a mano].

### 4. Frontend – PWA (`src/web/src/`)

* [COMPLETAR: herramienta] para [COMPLETAR: p. ej. las vistas `/juan`, `/maria`, `/tendero`, `/celular` y `/demo`, y los componentes].
* [COMPLETAR: qué se ajustó a mano].

### 5. Documentación

* `AI_USAGE.md`: estructura y redacción con Claude Code, a partir de la plantilla de la organización del hackatón. Revisado y completado por el equipo.
* [COMPLETAR: `README.md`, `docs/backlog.md`, `docs/context.md`: con qué herramienta y cuánto se editó a mano].

## IA dentro del producto (no como herramienta de desarrollo)

Paygent llama a la API de Claude en tiempo de ejecución. Esto es parte de la solución, no código generado:

* `src/agents/assistant/llm.py`: el Agente Asistente usa Claude con *tool use* para entender el SMS y proponer la compra. Todas sus acciones pasan por `/pay`, que aplica el sub-mandato y el PIN.
* `src/agents/intent/compiler.py`: convierte la intención de Juan en texto libre en el árbol de mandatos que él aprueba.
* Si no hay `ANTHROPIC_API_KEY` o el modelo falla, ambos usan reglas deterministas (`MOCK_LLM=1`).

## Lo que hicimos nosotros

* Probar y verificar todo el código sugerido por la IA, en especial el que mueve dinero: ningún pago se dio por bueno sin verlo en el Test Wallet.
* [COMPLETAR: decisiones de diseño propias: el mandato delegable, las reglas de los agentes, el modelo de vales offline, el guion de la demo…]
* Ficheros hechos con poca o ninguna IA: [COMPLETAR: lista de rutas].

## Registro de prompts

La carpeta [`/prompts`](prompts/) contiene el texto literal de los prompts de programación, un fichero por área de esta declaración.
