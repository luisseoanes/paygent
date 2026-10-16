# Modos de consumo

Un beneficiario paga por **tres modos**. Cada uno es una rama hija de la rama de la persona, con su propio tope, y
todos salen del mismo mandato raíz de su titular. Al registrar un beneficiario (`POST /mandates/:raíz/beneficiaries`)
quedan habilitados los tres.

| Modo | Rama (`mode`) | Quién paga | Cómo se usa desde la app | PIN |
|---|---|---|---|---|
| **Celular (vale QR)** | `device`, `celular` | El celular del beneficiario firma un vale | `/billetera` → **Pagar** → tienda y monto → mostrar el QR. Con señal el tendero lo cobra al instante; sin señal, hasta el **tope sin señal** | No (lo limita el tope sin señal) |
| **Asistente en la app** | `agent` (titular `asistente`), `asistente` | El Agente Asistente | `/billetera` → **Hablar con el asistente**. Busca, propone y paga | Por encima de 40.000 COP (o del tope del modo, si es menor) |
| **SMS** | `agent` (titular `asistente`), `sms` | El Agente Asistente | SMS desde el número con el que enlazó su cuenta, o el que registre el titular en **SMS con el Asistente**. Simulador: `/celular?tel=<número>` | Siempre |

"Sin señal" no es un modo aparte: es el tope sin señal de la rama del celular.

## Reparto del tope

La suma de los hijos no puede superar al padre, así que el tope de la persona se reparte al habilitar los modos:

- Celular: 40 % (o el techo sin señal, si es mayor). Lo que pone el titular como tope sin señal es el **techo**: el
  celular arranca con el 40 % de él y el Guardián lo mueve entre el 10 % y el techo.
- Asistente: 20 %. SMS: 20 %.
- El 20 % restante queda libre para subir cualquier modo sin bajar otro.

Cada modo del Asistente lleva una rama hija `<modo>-datos` (2.000 COP, solo `datos`) para pagar las consultas al
Agente de Inventario.

## Lo que hace el titular

En `/cuenta`, en la rama del beneficiario, **Formas de pagar** (todo va con la cuenta del titular en `x-user-id`):

- **Cambiar el tope** de un modo: `PATCH /mandates/:id/limits`. Sube o baja dentro de lo libre de la persona. Con
  `offlineCap` cambia el techo sin señal. Si baja el celular por debajo de su techo, el techo baja con él.
- **Quitar** un modo: `POST /mandates/:id/revoke`. Su tope vuelve a quedar libre.
- **Habilitar los que falten**: `POST /mandates/:persona/modes`. Crea una rama nueva por cada modo que falte. Sirve
  también para beneficiarios dados de alta antes de existir los modos: baja su celular a su parte y crea los demás.

## Canales del Asistente

- El chat de la app usa el perfil `app:<persona>`; existe desde el alta.
- El SMS usa el perfil con el número del beneficiario; se crea cuando enlaza su cuenta. Un número que ya habla con
  otra persona no se pisa. El titular puede poner otro número y un PIN propio del SMS con `PUT /mandates/:id/sms`
  (desde la persona o su celular): conecta la misma hoja del modo SMS, no crea otra.
- Con el puente Android, el número también tiene que estar en `SMS_BRIDGE_ALLOW`.
