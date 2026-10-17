# SMS, documentación técnica y estructura del repo (Rosvend) · reconstrucción

> **No es texto literal.** Los prompts de estas sesiones no se conservaron. Cada entrada reconstruye, a partir del
> commit que produjo, qué se le pidió a Claude Code (Claude Opus 5.5). El commit es la fuente verificable.

18 entradas · 16/10 · Claude Code (Claude Opus 5.5).

Código afectado: `docs/`, `src/` (estructura), `src/api/src/sms/`, `src/api/src/sms-bridge/`, `src/agents/assistant/`,
`site-docs/`, `diagrams/`, `README.md`, `AI_USAGE.md`.

## 1. 16/10 11:04 · `b73f56a`

Crea `AI_USAGE.md` a partir de la plantilla de las guías de IA del hackatón y una carpeta `prompts/` donde cada uno
deje los prompts de sus sesiones.

## 2. 16/10 11:07 · `35eb872`

Escribe `docs/producto/context.md` con el contexto del proyecto: el problema (Open Payments supone internet,
smartphone y wallet), los usuarios (Juan en el exterior, María, su mamá, el tendero) y la idea del mandato delegable.

## 3. 16/10 11:10 · `d4ac4e2`, `bf5f0b4`

A partir del contexto, arma `docs/producto/backlog.md` con las historias por área (gateway, Open Payments, vales sin
señal, SMS, agentes, frontend) y su prioridad para el hackatón.

## 4. 16/10 11:37 · `6d21521`

Reorganiza el monorepo: mueve `apps/`, `packages/` y `agents/` bajo `src/` sin romper los imports ni los scripts de
pnpm, y añade un `CLAUDE.md` del proyecto con cómo levantarlo y las reglas de trabajo.

## 5. 16/10 12:32 · `c8e10ed`

Los tests y el frontend nuevo fallan con un `.env` de wallets reales. Haz que funcionen en los dos casos, mock y Test
Wallet, sin cambiar lo que se prueba.

## 6. 16/10 12:59 · `6fd1187`

Colombia primero: la moneda raíz del árbol tiene que ser la de la wallet de Juan, COP por defecto. Que los montos se
muestren en pesos y que todo siga funcionando si Juan paga en dólares.

## 7. 16/10 13:07 · `aea8db7`

En `op:smoke`, si la URL pegada no es el callback de la wallet, explícalo con un mensaje claro, y quita los escapes
que mete zsh al pegarla.

## 8. 16/10 15:45 · `c1e5c90`

En Railway la web no sirve el build de producción con el *service worker*, y la PWA no abre sin señal. Arréglalo.

## 9. 16/10 15:46 · `4699f5f`

Puente SMS por adb: que un Android conectado reenvíe los SMS entrantes a `/sms/inbound` y devuelva la respuesta, y
que un vale enviado por SMS se liquide. Solo para números permitidos.

## 10. 16/10 15:51 · `a0c6055`

Quita `railway.json` de la web: el comando de inicio lo configuramos en Railway.

## 11. 16/10 17:16 · `68bb17b`

Las respuestas del Asistente por SMS se cortan a mitad de palabra. Recórtalas siempre en una frase completa, dentro
del límite de un SMS.

## 12. 16/10 17:22 · `06ef5e0`

Añade Telnyx como proveedor de SMS: webhook con firma verificada, respuesta asíncrona por su API y tests sin salir a
internet.

## 13. 16/10 17:26 · `e7323fe`

El titular tiene que poder activar el SMS de una rama desde su panel con el celular y un PIN. El PIN se guarda con
hash y el número se muestra enmascarado.

## 14. 16/10 17:38 · `99fea41`

Añade SMS Gateway for Android como proveedor: webhook firmado con HMAC y ventana anti-replay, y un filtro de
privacidad para que el celular-puente solo procese los SMS de Paygent y nunca registre el resto.

## 15. 16/10 21:30 · `28e7acb`

Haz los diagramas de arquitectura y del flujo de un pago para el pitch, en modo claro y oscuro.

## 16. 16/10 21:30 · `76a8437`

Monta un sitio técnico en inglés con Zensical (quickstart, arquitectura, API, seguridad), publícalo en GitHub Pages
con un workflow y rehaz el `README.md` como portada del repo.

## 17. 16/10 21:33 · `7494b39`

Pon los diagramas reales en el sitio y sus PNG en el README.

## 18. 16/10 22:20 · `41e7cde`

Añade al README capturas de la app y deja los diagramas con fondo transparente para que se vean bien en modo claro y
oscuro.
