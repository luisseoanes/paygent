# Cuentas y registro

Paygent tiene 3 tipos de cuenta. Cada una entra a su propia pantalla.

| Tipo | Qué hace | Pantalla |
|---|---|---|
| **Titular** | Tiene wallet de Open Payments, firma el mandato y reparte permisos | `/cuenta` |
| **Beneficiario** | Paga con el permiso que le dio un titular, con o sin señal | `/billetera` |
| **Tendero** | Escanea vales, los verifica sin internet y los cobra | `/tendero` |

> La sesión y las cuentas son de demostración: viven en el navegador (localStorage), no en el
> servidor, porque `src/api` no maneja cuentas. Las contraseñas se guardan en hash SHA-256,
> nunca en claro. Lo real es el mandato, el celular enlazado y los cobros.

## Crear una cuenta

- **Titular:** `/registrarse` (botón **Registrarse** en el menú). Pide documento, nombre,
  apellido, correo, celular, contraseña y la **wallet address pública** (por ejemplo
  `$ilp.interledger-test.dev/tu-nombre`). Al crearla entras directo a `/cuenta`, y esa wallet es
  la que se usa al firmar el mandato.
- **Beneficiario:** no se registra directo. Primero **Enlazar cuenta** (`/enlazar`, pública):
  escribe o escanea el código que le dio su titular. Al enlazar aparece **Te falta registrarte**
  (`/enlazar/registro`): nombre, documento, correo, teléfono y contraseña, sin wallet. Al
  terminar entra a `/billetera`.

El titular saca el código en `/cuenta` → su rama de tipo celular → **Vincular** (QR o código).
El QR abre `/enlazar?codigo=<id>` y enlaza solo.

## Cuentas de demo

Contraseña de las 5: **`paygent123`**. En **Iniciar sesión** hay 5 botones que llenan el
formulario de un toque.

| Tipo | Correo |
|---|---|
| Titular | `juan@paygent.dev` |
| Beneficiario | `maria@paygent.dev` (enlazada al código `maria-device`) |
| Tendero (Tienda Doña Rosa) | `tendero@paygent.dev` |
| Tendero (Farmacia San José) | `farmacia@paygent.dev` |
| Tendero (Minimercado El Paisa) | `minimercado@paygent.dev` |

## Código para enlazar

`maria-device`: es la rama "Celular de María", igual con la API real y con los mocks.

## Rutas viejas

`/juan` redirige a `/cuenta` (la API todavía vuelve a `/juan?ok=1` después de firmar) y
`/maria?vincular=<id>` redirige a `/enlazar?codigo=<id>`.

## Probar el pago sin señal en un computador

1. Entra como **Tendero**: su caja abre en **Tienda Doña Rosa**, la tienda de la cuenta.
2. En otra ventana de incógnito, entra como **Beneficiario** (o enlaza y regístrate).
3. DevTools → **Network** → **Offline**.
4. Beneficiario: **Pagar** → Tienda Doña Rosa → `12000` → **Generar vale** → **Copiar vale**.
5. Tendero: **Escanear vale** → **Pegar vale** → **Verificar vale** → sale **POR COBRAR**.
6. Network → **No throttling**: el vale pasa solo a **COBRADO**.
7. En el detalle del vale, **Reenviar vale** muestra el rechazo por doble cobro y el Guardián lo
   anota en la libreta del titular.

## En el celular

- Misma wifi: `http://<IP-del-PC>:5173`. Todo funciona menos la cámara.
- Con cámara: necesita HTTPS. Usa un túnel (`cloudflared tunnel --url http://localhost:5173`).
- Modo avión de verdad: `npm run build && npm run preview`, abre la app una vez con señal y luego
  activa el modo avión (el service worker solo existe en producción y con la API real).
