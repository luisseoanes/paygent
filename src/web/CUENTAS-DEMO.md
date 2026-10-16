# Cuentas de la demo

Paygent tiene 3 apps, una por persona. Cada una se abre con su cuenta.
La contraseña de las 3 es la misma: **`paygent123`**.

| Quién | Correo | Abre | Qué hace |
|---|---|---|---|
| **Juan** (quien delega) | `juan@paygent.dev` | `/juan` | Firma el mandato en su billetera, delega, congela, revoca y ve la libreta |
| **María** (quien paga) | `maria@paygent.dev` | `/maria` | Vincula su celular y paga con un vale QR, con o sin señal |
| **Tendero** (quien cobra) | `tendero@paygent.dev` | `/tendero` | Escanea el vale, lo verifica sin internet y lo cobra |

En la pantalla de **Iniciar sesión** hay 3 botones (Juan, María, Tendero) que llenan el
formulario de un toque. Al entrar, cada cuenta va directo a su app. Si abres la app de otra
persona, te pide cambiar de cuenta.

> La sesión es de demostración: vive en el navegador, no en el servidor (por eso dice
> "Sesión simulada"). Lo real es el mandato de Juan, el celular de María y los cobros.

## Código para vincular el celular de María

María lo necesita una sola vez y con señal. Juan lo ve en `/juan` → rama **Celular de María**
→ **Vincular** (QR o código).

| Modo | Código |
|---|---|
| Con la API real (`src/api`) | `maria-device` |
| Con los mocks (`VITE_APP_ENABLE_API_MOCKING=true`) | `mnd_maria_cel` |

## Probar el pago sin señal en un computador

1. Entra como **Tendero** y elige **Tienda Doña Rosa**.
2. En otra ventana (o en incógnito), entra como **María** y vincula el celular con el código.
3. DevTools → **Network** → **Offline**.
4. María: **Pagar** → Tienda Doña Rosa → `12000` → **Generar vale** → **Copiar vale**.
5. Tendero: **Escanear vale** → **Pegar vale** → **Verificar vale** → sale **POR COBRAR**.
6. Network → **No throttling**: el vale pasa solo a **COBRADO**.
7. En el detalle del vale, **Reenviar vale** muestra el rechazo por doble cobro, y el Guardián
   lo anota en la libreta de Juan.

> Una sesión vive por pestaña (`sessionStorage`): puedes tener a María y al tendero abiertos a
> la vez en 2 pestañas, cada una con su cuenta.

## En el celular

- Misma wifi: `http://<IP-del-PC>:5173/maria` o `/tendero`. Todo funciona menos la cámara.
- Con cámara: necesita HTTPS. Usa un túnel (`cloudflared tunnel --url http://localhost:5173`).
- Modo avión de verdad: `npm run build && npm run preview`, abre la app una vez con señal y luego
  activa el modo avión (el service worker solo existe en producción y con la API real).
