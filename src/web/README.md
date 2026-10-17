# Paygent — web

Firmado una vez en Texas. Pagado donde no hay señal.

## Empezar

Siempre con **pnpm** desde la raíz del repo (nunca `npm`: rompe `pnpm-lock.yaml` y el despliegue en Railway). Node 22
(`.node-version`): en Node 24 fallan los tests de rutas.

```bash
pnpm setup                          # en la raíz: instala todo
pnpm --filter @paygent/web dev      # http://localhost:5173
```

| Comando (`pnpm --filter @paygent/web …`) | Descripción |
| --- | --- |
| `dev` | Servidor de desarrollo |
| `build` | Build de producción |
| `validate` | Tipos + lint + formato + tests |
| `test` | Tests en modo watch |
| `lint:fix` | Autocorrección de lint y formato |

Variables de entorno en el `.env` de la raíz (ver `.env.example`). Con `VITE_APP_ENABLE_API_MOCKING=true` la API se
simula con MSW (`src/testing/mocks`), con las mismas reglas que la api real.

Arquitectura y reglas del proyecto: ver [`CLAUDE.md`](./CLAUDE.md). Identidad visual: [`BRAND.md`](./BRAND.md).
