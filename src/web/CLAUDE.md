# Paygent — Reglas del proyecto

Proyecto React estructurado según **Bulletproof React**. Estas reglas son obligatorias
para cualquier cambio (humano o IA). Para añadir cualquier cosa (feature, pantalla,
navbar, footer, componente, formulario...) usa la skill **`bulletproof-feature`**.

**`BRAND.md`** define la identidad del producto (colores, tipografía, estilo, voz, mapa de pantallas).
Todo cambio visual o de contenido debe respetarlo; los valores técnicos viven en `src/styles/theme.css`.

## Stack

Vite + React 19 + TypeScript estricto · Tailwind CSS v4 (design tokens) · React Router 7
· TanStack Query (estado del servidor) · Zustand (estado global) · React Hook Form + Zod
(formularios) · Axios (cliente API único) · Radix UI (primitivas accesibles) · lucide-react
(iconos) · Vitest + Testing Library + MSW (tests y API mock).

## Comandos

```bash
# Siempre pnpm (nunca npm: rompe pnpm-lock.yaml y el deploy). Tests con Node 22 (`fnm use`).
pnpm --filter @paygent/web dev        # servidor de desarrollo (http://localhost:5173)
pnpm --filter @paygent/web validate   # tipos + lint + formato + tests  ← debe pasar antes de dar algo por terminado
pnpm --filter @paygent/web lint:fix   # autocorrige lint + formato
pnpm --filter @paygent/web exec eslint --fix --cache --cache-location node_modules/.cache/eslint/ <archivos>
pnpm --filter @paygent/web build      # build de producción
```

## Estructura

```
src/
├── app/            # capa de aplicación: router, providers, rutas (páginas)
│   ├── routes/     # una ruta = un archivo; compone features. export default + clientLoader opcional
│   ├── provider.tsx
│   └── router.tsx
├── assets/         # estáticos globales (imágenes, svgs)
├── components/     # componentes COMPARTIDOS sin lógica de negocio
│   ├── ui/         # librería de diseño: button, card, form, dialog, typography...
│   ├── layouts/    # main-layout, site-header, site-footer, content-layout, container
│   ├── errors/     # fallbacks de error
│   ├── seo/        # <Head />
│   └── theme/      # modo claro/oscuro
├── config/         # env.ts (variables validadas), paths.ts (rutas), site.ts (marca y navegación)
├── features/       # módulos de negocio, uno por dominio  ← aquí vive la mayor parte del código
├── hooks/          # hooks compartidos
├── lib/            # librerías preconfiguradas (api-client, react-query)
├── stores/         # estado global (zustand)
├── styles/         # theme.css (TOKENS) y globals.css
├── testing/        # utilidades de test y mocks MSW
├── types/          # tipos compartidos
└── utils/          # funciones utilitarias compartidas (cn, format)
```

Una feature solo contiene las carpetas que necesita:

```
src/features/<feature>/
├── api/         # requests + hooks de react-query + schemas zod de esa feature
├── components/  # componentes de la feature
├── hooks/  stores/  types/  utils/  assets/
```

## Reglas de arquitectura (las hace cumplir ESLint)

1. **Flujo unidireccional**: `shared (components, hooks, lib, stores, types, utils, config) → features → app`.
   Lo compartido nunca importa de features ni de app; las features nunca importan de app.
2. **Sin imports entre features**. Si dos features deben combinarse, se componen en una ruta
   de `src/app/routes`. Si algo lo usan varias features, se mueve a la capa compartida.
3. **Imports absolutos** con `@/` (nada de `../../`). Dentro de un mismo módulo se permite `./` y `../`.
4. **kebab-case** para archivos y carpetas. Componentes en PascalCase, funciones/variables en camelCase.
5. **Sin barrel files en features**: importa el archivo directamente
   (`@/features/payments/components/payment-list`). Solo `components/ui/*` tiene `index.ts`.
6. **Named exports** en todo, excepto el componente de página en `app/routes/*` (export default).
7. **Nunca** desactives una regla de lint para que pase: corrige el código.
8. **Sin dependencias circulares** entre módulos (ESLint no lo comprueba por rendimiento; respétalo tú).
9. Mientras desarrollas, lintea solo los archivos tocados; la pasada completa (`lint:fix` o `validate`) una vez al final.

## Diseño y estilos

- La identidad visual vive en **`src/styles/theme.css`** (colores, fuentes, radios). Cambiar la marca = editar ese archivo.
- Usa **solo tokens semánticos**: `bg-background`, `text-foreground`, `bg-primary text-primary-foreground`,
  `text-muted-foreground`, `border-border`, `bg-card`, `text-destructive`, `bg-success`... Los colores crudos
  (`bg-blue-500`, `text-[#fff]`) están prohibidos por ESLint. Si falta un color, añade un token (con su `-foreground`).
- Tipografía: usa `<Heading level="display|h1|h2|h3|h4">` y `<Text variant="lead|body|small|muted|caption">`
  de `@/components/ui/typography`. No estilices `h1`/`p` a mano.
- Layout: cada página usa `<ContentLayout title=...>` o `<Container>`; espaciado con la escala de Tailwind
  (múltiplos de 4: `gap-4`, `py-8`, `py-12`...). Mobile-first (`sm:`, `md:`, `lg:`).
- Antes de crear un componente, revisa `src/components/ui`. Reutiliza; extiende con variantes `cva`
  en vez de duplicar. Componer con `children`/slots en vez de muchas props.
- Clases condicionales siempre con `cn()` de `@/utils/cn`.
- Debe verse bien en modo claro y oscuro (los tokens lo resuelven si no usas colores crudos).

## Datos y estado

- **Estado del servidor** → TanStack Query. Cada endpoint en `features/<f>/api/<verbo>-<recurso>.ts` con:
  schema/tipos → función fetcher que usa `api` de `@/lib/api-client` → `queryOptions` → hook `use<Algo>`.
- **Estado de componente** → `useState`/`useReducer`, lo más cerca posible de donde se usa.
- **Estado global** → zustand en `src/stores` (o en `features/<f>/stores` si es de una feature). Solo si de verdad es global.
- **Formularios** → `<Form schema={zodSchema}>` + `Input`/`Textarea`/`Select` de `@/components/ui/form`.
- **Estado en URL** → filtros, paginación, ids: `useParams` / `useSearchParams`.
- Nunca guardes datos del servidor en zustand.
- Rutas: declaradas en `src/config/paths.ts`; enlaces con `paths.x.getHref()`, nunca strings sueltos.
- Variables de entorno: prefijo `VITE_APP_`, declaradas y validadas en `src/config/env.ts`.
- Sin backend todavía: crea handlers MSW en `src/testing/mocks/handlers/<feature>.ts`.

## Calidad obligatoria en cada pantalla/componente

- Estados de **carga** (`<Spinner />` o skeleton), **vacío** y **error** contemplados.
- `ErrorBoundary` local (`SectionErrorFallback`) alrededor de secciones que pueden fallar.
- Accesibilidad: HTML semántico, `alt` en imágenes, `aria-label` en botones de solo icono,
  foco visible, labels en inputs (los componentes de `ui/form` ya lo resuelven).
- Seguridad: nunca `dangerouslySetInnerHTML` sin sanitizar con DOMPurify. Tokens en cookies HttpOnly.
- Rendimiento: rutas con `lazy` (ya configurado), estado colocado, `children` para evitar re-renders,
  imágenes con `loading="lazy"` y dimensiones.
- Tests: tests de integración en `__tests__/` junto a la ruta/feature, probando comportamiento
  como un usuario (Testing Library + MSW), no detalles de implementación.
- Formato de fechas/monedas solo con `@/utils/format`.
