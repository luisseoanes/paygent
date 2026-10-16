# Paygent

Firmado una vez en Texas. Pagado donde no hay señal.

## Empezar

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comando            | Descripción                      |
| ------------------ | -------------------------------- |
| `npm run dev`      | Servidor de desarrollo           |
| `npm run build`    | Build de producción              |
| `npm run validate` | Tipos + lint + formato + tests   |
| `npm run test`     | Tests en modo watch              |
| `npm run lint:fix` | Autocorrección de lint y formato |

Variables de entorno en `.env` (ver `.env.example`). Con `VITE_APP_ENABLE_API_MOCKING=true`
la API se simula con MSW (`src/testing/mocks`).

Arquitectura y reglas del proyecto: ver [`CLAUDE.md`](./CLAUDE.md).
