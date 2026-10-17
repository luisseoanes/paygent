# Despliegue (Railway)

Producción: **https://paygent.up.railway.app**. Proyecto de Railway con cuatro servicios en el entorno `production`.

| Servicio | Origen | Arranque | Vigila |
|---|---|---|---|
| `@openroute/api` | raíz del repo | `pnpm --filter @openroute/api start` (puerto 3001) | `/src/api/**`, `/src/shared/**`, lockfile, `pnpm-workspace.yaml`, `package.json` |
| `@openroute/web` | raíz del repo | build `pnpm --filter @paygent/web build` · start `pnpm --filter @paygent/web start` (`vite preview` en `$PORT`, 8080) | `/src/web/**`, `/src/shared/**`, lockfile, `pnpm-workspace.yaml`, `package.json` |
| `agents` | `/src/agents` | `python main.py` (puerto 8000) | `/src/agents/**` |
| `Postgres` | plantilla de Railway | — | — |

- **El dominio apunta a la web, al puerto 8080.** La web reenvía `/api/*` a la api y `/agents/*` a los agentes por la
  red privada (`*.railway.internal`), así el celular solo necesita una URL.
- **Un servicio solo se vuelve a desplegar si cambian sus rutas vigiladas.** Un push que solo toca la web no reinicia
  la api.
- **Cada push a `main` despliega.** Durante la demo, nadie hace push: reiniciar la api corta lo que esté en marcha.
- Si un build falla, Railway mantiene viva la versión anterior.

## Variables

| Servicio | Variable | Notas |
|---|---|---|
| api | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (red privada) |
| api | `MOCK_OP=0` | Dinero real. En la demo, siempre 0 |
| api | `MOCK_FX` (vacío = 0), `FX_COP_PER_USD` | Trae la TRM del día de datos.gov.co; `FX_COP_PER_USD` es el respaldo sin red |
| api | `OP_CLIENT_WALLET`, `OP_KEY_ID`, `OP_PRIVATE_KEY` | Identidad de Paygent ante Open Payments. `OP_PRIVATE_KEY` = contenido de `private.key` (PEM o base64): en Railway no hay fichero |
| api | `AGENT_SERVICE_KEY` | Secreto aleatorio. Agents lo toma por referencia |
| api | `PUBLIC_API_URL`, `WEB_URL`, `AGENTS_URL` | `https://paygent.up.railway.app/api`, `https://paygent.up.railway.app`, `http://agents.railway.internal:8000` |
| agents | `API_URL`, `AGENTS_URL`, `AGENT_SERVICE_KEY` | `http://<api>.railway.internal:3001`, `http://localhost:8000`, `${{@openroute/api.AGENT_SERVICE_KEY}}` |
| agents | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `MOCK_LLM=0` | Sin clave, el Asistente responde con reglas |
| web | `API_URL`, `AGENTS_URL` | Destinos del proxy (red privada) |
| web | `VITE_APP_API_URL=/api`, `VITE_APP_ENABLE_API_MOCKING=false` | Sin `VITE_APP_API_URL` la web no arranca |

Las wallets de titulares y comercios **no** son variables: viven en la base ([modelo de datos](../api/modelo-de-datos.md)).

## Antes de hacer push

- **El lockfile, siempre con pnpm.** Railway instala con `--frozen-lockfile`; un `npm install` en `src/web` rompe el
  build. Cada paquete que se importe tiene que ser dependencia directa.
- Pasa en local: `pnpm typecheck`, los tests (los de la web con Node 22) y `pnpm --filter @paygent/web build`.
- Revisa `git status` antes del commit: un fichero sin añadir puede dejar a `main` sin compilar.

## Verificar producción

- **Sin crear datos:** llama a rutas de validación (un correo repetido → 409, un código de rama que no existe → 400)
  y a lecturas (`/api/demo/status?root=`, `/api/health/op`, `/agents/health`).
- **Que el deploy incluye tu commit:** compara con `git merge-base --is-ancestor <tu-commit> <commit desplegado>`; si
  otro compañero hizo push después, Railway despliega su commit, que ya contiene el tuyo.
- Si la web responde 502, revisa que el dominio apunte al puerto en el que escucha (`$PORT`).
- Si un pago falla con `Inactive Token` justo tras desplegar, no es un bug: el token se rota en el siguiente intento.

## Restaurar la demo

`POST /api/demo/reset` vuelve a sembrar la demo de Juan **conservando su grant** (no hay que volver a firmar).
`{ "full": true }` también borra el grant. Ninguno de los dos toca las cuentas registradas.
