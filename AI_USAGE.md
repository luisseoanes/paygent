# Declaración de uso de IA

## Herramientas utilizadas

* Claude Code (Claude Opus 5.5)
* Es la única herramienta de IA que usó el equipo (Pedro, Luis, Rosvend y Carlos): no usamos ChatGPT, Copilot ni Cursor.

## Dónde y cómo usamos la IA

Lo hecho en las sesiones de Claude Code de Pedro (S1–S6) y de Luis (S7), con fechas en
[`prompts/README.md`](prompts/README.md), está detallado abajo, con sus ficheros; sus prompts literales están en
[`/prompts`](prompts/). Cada miembro completa lo suyo.

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
* Claude Code (Luis): cobro en pesos con la wallet de Juan en dólares, umbral de PIN calculado con el débito real
  cotizado y `fx-probe` para medir la tasa del Test Wallet (`op/`, `gateway/pay.ts`, `src/api/scripts/`).
* Claude Code (Rosvend): la moneda raíz es la de la wallet de Juan (COP por defecto) y `op:smoke` explica cuándo la
  URL pegada no es el callback de la wallet.

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
* Claude Code (S7, Luis), diagnóstico en producción con la CLI de Railway (logs, consultas de solo lectura a la base
  y la API de la nube de SMS Gateway):
  * Un número no se podía activar en el SMS de una rama («ya habla con el Asistente desde otra rama») porque seguía en
    la hoja SMS viva de otra rama: se liberó con `desactivarSms` (`gateway/sms-canal.ts`), con aprobación explícita.
  * Una cuenta de beneficiario registrada con el código de otra rama: se movió a la rama correcta con
    `linkHolderUser`, `linkPersonIfFree` y `linkModeProfiles` en una transacción, con aprobación explícita.
  * Merge de `feat/puntored-simulado` a `main`: conflictos resueltos conservando los dos lados
    (`merchants/routes.ts` con `/merchants/:id/payments` y `/merchants/:id/credits`, `docs/api/endpoints.md`).
  * Prueba de humo contra producción sin `/demo/reset` (script temporal, no se subió): grant raíz, TRM, Asistente
    (saldo y compra), vale firmado y liquidado por SMS, y el SMS de un beneficiario. Pasaron los 9 pasos.
* Claude Code (Luis): domicilio, cobro de comercios por Puntored y umbral de PIN; PIN bloqueado tras fallos, vale
  cobrado una sola vez y SMS liberado al revocar (`gateway/pin.ts`, `vouchers/settle.ts`, `gateway/sms-canal.ts`); el
  tendero que se registra y cobra sin wallet, con acreditación simulada de Puntored en su llave Bre-B
  (`gateway/acreditacion.ts`, `merchants/`).
* Claude Code (Rosvend): el titular activa el SMS de una rama con celular y PIN (`gateway/sms-canal.ts`), proveedores
  de SMS Telnyx y SMS Gateway for Android con webhook firmado y filtro de privacidad (`sms/`), y el puente SMS por adb
  con vales liquidados por SMS (`sms-bridge/`, `sms/vale.ts`).

### 3. Agentes (`src/agents/`)

* Claude Code (S1–S3): el PIN de 4 a 6 dígitos se intercepta antes del LLM (`assistant/router.py`), el
  Asistente paga en la moneda del árbol de quien escribe (`assistant/tools.py`), cliente de la api y comercios
  (`common/`) e inventario (`inventory/`), con sus tests en `tests/test_assistant.py`.
* Claude Code (S5): el PIN se intercepta también dentro de una frase («mi pin es 1234», «Clave: 1234»), y si hay una
  compra esperando PIN, los dígitos llegan tapados al LLM (`assistant/router.py`, `tests/test_assistant.py`).
  Se quitó código sin uso (`web_offers`).
* Claude Code (Luis): el servicio FastAPI y el compilador de intención (commit inicial); el Asistente con Claude y
  *tool use* para cualquier beneficiario, con las reglas de Paygent en el prompt (`assistant/`); el Agente de
  Inventario que busca el producto en internet y en la zona de la demo (OpenStreetMap con varios servidores de
  Overpass) y ordena las tiendas de la más cercana a la más lejana (`inventory/`); el Guardián, con sus reglas
  revisadas en vivo y el tope sin señal que sube con buen uso (`guardian/`); y el reintento de la TRM al arrancar.
* Claude Code (Rosvend): las respuestas por SMS se recortan en una frase completa, nunca a mitad de palabra.

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
* Claude Code (S7, Luis): un celular enlazado a una rama borrada seguía firmando vales con su certificado (el 404 se
  callaba) y con la TRM de cuando se enlazó; la tienda los leía con otro monto y el gateway los rechazaba. Ahora deja
  de firmar si su rama ya no existe y toma la TRM del día en cada revisión con señal
  (`features/billetera/hooks/use-refrescar-dispositivo.ts`, test en `hooks/__tests__/`). En el merge,
  `app/routes/tendero.tsx` conserva la tienda de la cuenta y la sección de cobros de Puntored.
* Claude Code (Carlos, prompts en [`prompts/prompts_carlos_florez.md`](prompts/prompts_carlos_florez.md)): el
  frontend nuevo con la estructura de *bulletproof-react* y referencias de Mobbin; la portada pixel art con paisajes
  animados, la historia «sin señal» por escenas y la sección de agentes (`features/marketing/`); las PWAs de María y
  del tendero con vales sin señal; cuentas por tipo, registro, enlace y menú de cuenta; el login en nube pixelada;
  el chat con el Asistente para María; el historial por delegado; y el logo (la P con ramas) en la app y el favicon.
* Claude Code (Rosvend): servir el build de producción con *service worker* en Railway.

### 5. Documentación

* `AI_USAGE.md`: estructura y redacción con Claude Code, a partir de la plantilla de la organización del hackatón.
* Claude Code (S1–S3): `README.md`, `CLAUDE.md`, `src/web/CLAUDE.md`, `docs/api/`, `docs/operacion/`,
  `docs/open-payments/test-wallet.md` y `docs/producto/modos-de-consumo.md`. Revisado por Pedro.
* Claude Code (S4): `docs/arquitectura.md` (capas, camino del dinero, seguridad, decisiones), la matriz de permisos
  en `docs/api/endpoints.md`, `docs/operacion/sms.md`, `src/web/README.md` y, en el sitio público,
  `site-docs/architecture.md`, `security.md` y `api-reference.md`. S5: compromisos conocidos y riesgos al día en
  `docs/arquitectura.md` y `site-docs/security.md`. El registro de `prompts/` (S6), por área de trabajo.
* Claude Code (S7, Luis): `prompts/produccion-y-diagnostico.md`, esta actualización de `AI_USAGE.md`, la
  descripción del repositorio para GitHub y la revisión de la entrega frente a los criterios del jurado.
* Claude Code (Rosvend, Pedro y Luis): `docs/producto/context.md` y `docs/producto/backlog.md`, escritos a partir de
  las ideas del equipo y revisados a mano; Rosvend también el sitio técnico en inglés con Zensical, publicado en
  GitHub Pages, y los diagramas de arquitectura y del flujo de pago.
* Claude Code (Carlos): el pitch de 5 minutos y las diapositivas de `entrega/`, según los criterios del jurado.

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
* Decisiones de Luis (S7): autorizar cada cambio en la base de producción después de ver el diagnóstico, integrar
  `feat/puntored-simulado` en `main` antes de grabar, y desplegar el arreglo del celular que firmaba vales.
* Decisiones del equipo, en `docs/producto/context.md` y `backlog.md`: el mandato delegable como primitiva (un solo
  grant repartido en ramas firmadas cuya suma nunca supera a la de arriba), que el gateway decida cada pago y nunca el
  modelo, los vales firmados con tope sin señal para pagar sin internet, y el SMS con PIN para celulares básicos.
* Luis: el Guardián administra el tope sin señal, el Asistente busca lo más cercano a la persona y responde en lo que
  cabe en un SMS, el umbral de PIN, y Puntored con llave Bre-B para tenderos sin wallet.
* Rosvend: Colombia primero (pesos por defecto), SMS Gateway for Android como número real y la documentación técnica
  en inglés.
* Carlos: la identidad pixel art, la historia «sin señal» contada por escenas y el guion del pitch y de la demo.
* Ficheros hechos con poca o ninguna IA: los retoques de texto de la portada que Pedro hizo a mano (commit `71fe3a0`:
  `features/marketing/components/hero-paisaje.tsx`, `problema.tsx` y `sin-senal.tsx`). El resto se hizo con Claude
  Code y lo revisó y probó a mano quien lo pidió.

## Registro de prompts

La carpeta [`/prompts`](prompts/) contiene el texto literal de los prompts de programación, un fichero por área de
trabajo (índice en [`prompts/README.md`](prompts/README.md)). Los datos personales y de
autorización están sustituidos por `[…]`.

Son literales los de Pedro (S1–S6), Carlos y Luis del 17/10 (S7). Los de Rosvend y los de Luis del 16/10 no se
conservaron: están **reconstruidos** a partir de cada commit, marcados como tales y con el hash para contrastarlos con
`git log` ([`reconstruidos-rosvend.md`](prompts/reconstruidos-rosvend.md),
[`reconstruidos-luis-16-10.md`](prompts/reconstruidos-luis-16-10.md)).
