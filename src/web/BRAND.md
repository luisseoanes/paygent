# Brief de marca y producto — Paygent «Vale por»

<!-- DESIGN-SYSTEM:START (generado por apply-design-system.mjs) -->

## Sistema de diseño base: Editorial (`editorial`)

> Papel, tinta y un rojo de portada. Hecho para leer largo. Inspiración: The New York Times, The Atlantic, revistas impresas.

- **Tipografías**: títulos Fraunces Variable · texto Newsreader Variable · cifras/código IBM Plex Mono
- **Escala**: dramatic · base 18px · títulos peso 600/500, tracking -0.02em
- **Forma**: radio 0.25rem · botones rounded · sombras none · bordes 1px
- **Color**: primario #B3261E (claro) / #F2867C (oscuro) · fondo #FBF9F4 / #161513 · modo por defecto según el sistema

Lo que el brief defina explícitamente (colores, fuentes, forma) tiene prioridad sobre estos valores.
<!-- DESIGN-SYSTEM:END -->

> Fuente: `Paygent — Dirección creativa y blueprint frontend.md` y `proyecto-hackathon-open-payments.md` (raíz del monorepo).
> `/bulletproof-feature` consulta este archivo en cada cambio.

## 1. Identidad

- **Nombre de la app**: Paygent
- **Tagline**: Firmado una vez en Texas. Pagado donde no hay señal.
- **Descripción (SEO)**: Un solo permiso de Open Payments, repartido entre personas y agentes de IA. Doña Rosa pide su medicina por SMS, María paga sin señal y nadie retiene el dinero.
- **Problema que resuelve**: Open Payments asume internet, smartphone y billetera propia. Paygent elimina los tres supuestos con una sola primitiva: el mandato delegable (grant GNAP con `debitAmount` + `interval`) que se ramifica en sub-mandatos firmados para personas, dispositivos y agentes.
- **Público objetivo**: Juan (emisor en Texas, smartphone), Doña Rosa (mamá en vereda, celular de teclas, SMS), María (cuidadora, señal intermitente), tendero/farmacia, y el jurado de la hackathon (proyector).
- **Idioma**: es · **Locale**: es-CO · **Moneda**: USD (COP como equivalente, marcado SIMULADO)
- **Formato de fecha**: "15 oct 2026", horas en mono "09:02".

## 2. Personalidad y estilo visual

- **Sistema de diseño base**: `editorial` (papel y tinta), sobrescrito por la paleta «Vale por».
- **Adjetivos**: notarial, cálido, preciso, honesto.
- **Idea rectora**: la confianza se ve como un papel firmado. Mandato = documento sellado; ramas = colillas de talonario; pago offline = vale perforado; cada pago tiene comprobante con reverso técnico real.
- **Lo que NO quieres**: gradientes, vidrio, emoji, fuentes manuscritas, 3D, tarjetas con radio 16 px, sombras de color, fondos oscuros, blanco puro, tono de control parental, fotos de stock.
- **Densidad**: normal.
- **Modo oscuro**: solo claro.

## 3. Colores (significado fijo de los sellos)

- `paper` #F4EFE4 (fondo, nunca blanco) · `paper-raised` #FBF8F1 · `paper-sunken` #EAE3D3
- `ink` #1C2230 · `ink-2` #5B6170 · `ink-3` #8B8F99 (solo deshabilitado)
- `rule` #D9D0BD · `rule-strong` #B9AD93
- `firma` #1F3FAE (principal: Juan autoriza, CTA, foco, tinta en tránsito) · tint #E3E8F7
- `agente` #5A3E9E (actúa un agente) · tint #ECE6F5
- `resaltador` #F2C230 (solo fondo, una vez por pantalla)
- `liquidado` #1E7A4C · tint #E2F0E7
- `anulado` #C2362B · tint #F8E4E1 (restringir, rechazar, congelar, revocar)
- `pendiente` texto #8A5A12 · borde #B7791F · tint #F6EBD6
- LCD del celular: `lcd` #C9D4B0 · `lcd-ink` #1F2A17 · `carcasa` #2B2D31 · `led` #3FBF4F
- **Gradientes**: no.

## 4. Tipografía

- **Títulos**: Fraunces Variable (opsz, 600, tracking −0.01/−0.02em). Notas "por qué" en Fraunces itálica.
- **Texto/UI**: Public Sans Variable, base 17px.
- **Mono**: IBM Plex Mono para montos, folios, IDs, etiquetas (MAYÚS +0.08em) — siempre tabular.
- **LCD**: VT323 solo dentro del celular simulado.

## 5. Forma, profundidad y movimiento

- Radio 2 px en papel, 6 px en controles. Botones no píldora.
- Sombra de papel: `0 1px 0 rgb(28 34 48 / .06), 0 10px 24px -14px rgb(28 34 48 / .22)`.
- Recursos de marca: perforación (puntos 4 px cada 10 px), sellos SVG rotados −6°…4°, folio `N.º 000127`, regla de consumo con marcas cada 10%, código de línea por conectividad (sólida = en línea, discontinua 6/4 = vale sin señal, punteada 1/5 = SMS).
- Animaciones con Motion: sello cae 220 ms `cubic-bezier(.2,1.4,.4,1)`, tinta 900 ms, volteo 480 ms, regla 420 ms. Respetar `prefers-reduced-motion`.
- Ancho máximo: 1280px (Escenario a pantalla completa).

## 6. Logo, iconos e imágenes

- **Logo**: wordmark en Fraunces "Paygent" con un pequeño sello.
- **Favicon**: sello circular azul firma.
- **Iconos**: lucide 1.5 px.
- **Imágenes**: ninguna; la identidad la cargan objetos y tipografía.

## 7. Estructura y navegación

- **Tipo**: portada + apps de rol + Escenario de demo.
- **Header**: sticky, 64 px; wordmark izq.; "Qué es real" y botón "Abrir escenario" der.
- **Menú**: secciones de la portada (Qué es, Cómo funciona, Agentes, Sin señal, Qué es real). Las apps de rol (María, Tendero, Celular) se sumarán cuando existan.
- **Footer**: una línea.

## 8. Mapa de pantallas

- `/` · Portada · hero (paisaje pixel + celular en autoplay) → Qué es → Problema → Cómo funciona → Agentes (gateway decide) → Sin señal → Qué es real → Cierre. Las animaciones usan una simulación local (`features/marketing/utils`), no la API.
- `/iniciar-sesion` · Iniciar sesión · paisaje a la izquierda, formulario en papel a la derecha; vuelve a `redirectTo`.
- `/juan` · Panel de Juan (requiere sesión) · sin grant: "Firmar en mi billetera" (tope + periodo → consentimiento del Test Wallet → vuelve con `?ok=1|0`). Con grant, ordenado por las 3 tareas de Juan: (1) resumen "Quedan $X de $Y" sobre el cielo pixel con la barra "Quién lo gastó" y dos acciones (Delegar · Libreta); (2) delegados como lista de personas con sub-ramas colgando de una línea y "Delegar a alguien más" al final; el Guardián aparte en "Te cuida"; (3) en cada rama, acciones a un toque en círculos (Congelar/Reactivar, Sin señal, Delegar, Revocar), datos en filas etiqueta-valor y sus movimientos. La actividad va agrupada por día con el porqué siempre visible y las alertas en rojo. "Revocar todo" vive al fondo. Revocar una rama = 3 toques; la rama queda tachada con sello ANULADO. Sin chat.
  Datos reales: `GET /demo/status` (¿hay grant?), `POST /mandates/root`, `GET /mandates/:id/tree`, `POST /mandates/:id/delegate`, `POST /mandates/:id/revoke`, `PATCH /mandates/:id/restrict`, `POST /mandates/:id/unfreeze`, `GET /feed/stream` (SSE). MSW replica las mismas reglas con `VITE_APP_ENABLE_API_MOCKING=true`.
- `/maria` · PWA de María (celular, 360 px, sin el menú de la portada) · Vincular este celular (escanear el QR de Juan o escribir el código; `?vincular=<id>` vincula sola) → Inicio "Puedes gastar este mes" + "Sin señal te quedan" (regla de consumo, borde discontinuo) + botón Pagar → ¿Dónde? (comercios) → ¿Cuánto? (teclado grande en COP, "≈ USD · tasa de referencia") → Vale: QR enorme en papel con perforación, borde sólido con señal / discontinuo sin ella. El vale se firma en el celular con `@openroute/shared` (llaves e historial en IndexedDB).
- `/tendero` · PWA del tendero · ¿Cuál es tu tienda? (una vez, con señal) → Caja: "Hoy recibiste" con Cobrado / Por cobrar, vales recibidos con su estado, botón Escanear vale abajo → Escáner (visor oscuro con esquinas; "Pegar vale" para la demo en computador) → Resultado a pantalla completa con sello COBRADO / POR COBRAR (discontinuo) / RECHAZADO + motivo en lenguaje simple, vibración y tono. Al volver la señal la cola se cobra sola (`/vouchers/settle`). Detalle de un vale cobrado: "Reenviar vale" (demo de doble cobro → rechazo + evento del Guardián en la libreta de Juan).
- En `/juan`, la rama de tipo celular tiene la acción "Vincular" (QR a `/maria?vincular=<id>` + código).
- Navbar: Qué es · Cómo funciona · Agentes · Sin señal · Qué es real. Cada botón lleva a su sección de la portada (`/#seccion`) desde cualquier pantalla y marca la sección que se está leyendo; el wordmark vuelve al inicio. A la derecha, "Iniciar sesión" / "Mi mandato" · "Cerrar sesión".

## 9. Voz y contenido

- **Tono**: cercano y respetuoso, delegación entre iguales. **Trato**: tú.
- Botones: "Firmar en mi billetera", "Pagar con vale", "Revocar rama", "Abrir el escenario en vivo".
- Errores: claros y sin culpar: "No se firmó. Nada cambió."
- SMS sin tildes ni ñ (GSM-7), <160 caracteres.

## 10. Datos y backend

- **API**: `apps/api` (puerto 3001). MSW la simula con los mismos ids y reglas (`root` es el mandato raíz).
- **Entidades**: MandateNode (árbol), FeedEvent, Payment, Voucher, SmsMessage.
- **Autenticación**: la sesión es una puerta de demo en el navegador (siempre Juan, marcada SIMULADO). Lo real es el grant GNAP que Juan aprueba en el Test Wallet.
- **Marcas de autenticidad**: todo dato lleva REAL · TESTNET o SIMULADO.

## 11. SEO

- **Título**: Paygent — Vale por

## 12. Calidad

- Ambos: escritorio para el Escenario (1920×1080 y 1366×768), móvil 360 px para María y tendero.
- Accesibilidad AA reforzada: áreas táctiles ≥ 48 px, foco 3 px firma, `role=tree`, `aria-live` en la libreta, color nunca solo.

## 13. Notas

- En el Escenario ningún texto baja de 16 px.
- El sello LIQUIDADO solo cae con `payment.completed`; nunca estados optimistas en dinero.
- No decir que AP2 es cerrado.
