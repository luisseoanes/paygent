# Open Payments en la práctica (Test Wallet)

Comportamiento comprobado contra `ilp.interledger-test.dev` con `@interledger/open-payments` 7.4.0, y cómo lo
resuelve Paygent. El flujo completo está en `src/api/src/op/` (`grants.ts`, `settle.ts`).

## Lo que funciona

- Grants de outgoing payment con `limits.debitAmount` + `limits.interval` (`P1M` y `PT5M`).
- Cuentas en COP y en USD. Pago USD → COP con quote (unos 3.180 COP por USD el día de la prueba).
- Pagos de $0.01.
- Emisor y receptor pueden ser accounts del mismo usuario.
- Sin probar: outgoing payment sin quote (`incomingPayment` + `debitAmount`).

## Trampas y cómo las resolvemos

| Lo que pasa | Qué hace Paygent |
|---|---|
| El access token del grant caduca a los pocos minutos y el resource server responde **403 `Inactive Token`**, no 401 | `settle` rota el token con `token.rotate` ante 401 **y** 403 y reintenta (`isExpiredToken`). La rotación funciona aunque el token ya esté vencido |
| Si el titular revocó el grant, la rotación también falla | Error legible: "El mandato de Juan fue revocado o venció en su billetera" |
| `outgoingPayment.create` responde bien **aunque el pago luego falle** (p. ej. sin saldo) | `settle` espera hasta 15 s a que el comercio reciba (`receivedAmount`) o el outgoing quede `failed`; el pago queda `pending` hasta saberlo |
| Un incoming payment sin cerrar **retiene el dinero**: no llega al saldo del comercio hasta que se completa o caduca (30 días) | `settle` siempre lo cierra con `incomingPayment.complete` |
| En *Transactions*, un incoming sin `incomingAmount` sale como "+COP 0.00 PENDING" aunque haya recibido | Se crea con `incomingAmount` cuando hay precio; el monto real está en `receivedAmount` |
| `result=invalid_interaction` al volver de la billetera: el grant sale APPROVED pero sin `interact_ref` no sirve | Iniciar sesión en el Test Wallet **antes**, abrir el enlace una sola vez y sin recargar |
| La moneda la fija el account, no la wallet address; no se puede cambiar | Cada árbol va en la moneda de la wallet de su titular |
| Los nombres de wallet address son globales (`/juan` ya era de otra persona) | Comprobar con `curl -H 'Accept: application/json' <url>` antes de usar una |
| La tasa real no es la de referencia (4.000) | El quote fija lo que recibe el comercio (`incomingAmount`) y la autorización usa el débito real cotizado |
| `incomingPayment.list` con `last` exige cursor | Paginar con `first` |

## Probarlo

- `pnpm op:smoke` (con `MOCK_OP=0`): pide el grant, imprime la URL de consentimiento y, con la URL de vuelta, hace un
  pago real pequeño.
- `pnpm --filter @openroute/api fx:probe 12000`: cotiza sin pagar cuánto le cuesta a Juan que un comercio reciba esos pesos.
- Para confirmar que el dinero llegó, mira el `receivedAmount` del incoming del comercio, no solo la respuesta del outgoing.
