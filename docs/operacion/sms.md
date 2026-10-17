# SMS reales

Tres formas de conectar un número real con Paygent. Todas usan el mismo despacho que `/sms/inbound`: un `VALE …` se
liquida en el gateway y lo demás va al Asistente. En desarrollo basta con la vista `/celular` (`MOCK_SMS=1`); para hablar
como cualquier beneficiario, `/celular?tel=<número>`.

Un número solo habla con el Asistente si tiene canal SMS: el modo SMS de un beneficiario (su celular al enlazar la
cuenta, o el que registre el titular) o un perfil de la demo. Ver [modos de consumo](../producto/modos-de-consumo.md).

## SMS real con tu celular (`pnpm sms:bridge`)

Sin Twilio: un Android conectado por USB hace de gateway SMS. El puente lee la bandeja con `adb`, reenvía a `<api>/sms/inbound` y contesta con un SMS real (servicio `isms`, sin abrir ninguna app).

1. Activa la depuración USB y comprueba `adb devices`.
2. En `.env` (o en la línea de comandos): `SMS_BRIDGE_ALLOW` con los números que pueden escribir (el celular es personal: **todo lo demás se ignora sin leer el cuerpo**, y los códigos cortos nunca pasan), `SMS_BRIDGE_ALIAS=<tu número>=+573001112233` para hablar como Doña Carmen, `SMS_BRIDGE_API` (local o `https://paygent.up.railway.app/api`), `ADB_SERIAL` y `SMS_BRIDGE_SUB_ID` (la SIM de SMS: `defaultSmsSubId` en `adb shell dumpsys isub`).
3. `pnpm sms:bridge`. Solo atiende mensajes que lleguen después de arrancar.

## SMS real por SMS Gateway for Android (recomendado en Colombia)

Telnyx no tiene números colombianos con SMS. [SMS Gateway for Android](https://docs.sms-gate.app/) convierte un Android con SIM colombiana en el número de Paygent, por su propio internet (sin cable ni computador): la app manda cada SMS entrante al webhook y envía la respuesta.

`POST /sms/smsgate` verifica la firma HMAC-SHA256 (`X-Signature` sobre cuerpo + `X-Timestamp`, ventana de 5 min), responde 200 de inmediato y envía la respuesta por la API de la nube. **Privacidad:** el celular-puente reenvía todo su SMS, así que solo se atienden números con canal SMS activo o un `VALE …`; los códigos cortos nunca reciben respuesta y lo demás se descarta sin registrarse.

1. Instala la app en el celular-puente, activa **Cloud server** y anota usuario y contraseña. En **Settings → Webhooks** copia la **Signing Key**.
2. Variables (Railway o `.env`): `SMS_PROVIDER=smsgate`, `MOCK_SMS=0`, `SMSGATE_USERNAME`, `SMSGATE_PASSWORD`, `SMSGATE_SIGNING_KEY`.
3. Registra el webhook: `curl -u <usuario>:<contraseña> -H 'content-type: application/json' -d '{"url":"https://paygent.up.railway.app/api/sms/smsgate","event":"sms:received"}' https://api.sms-gate.app/3rdparty/v1/webhooks`
4. `VITE_APP_SMS_GATEWAY_NUMBER` = el número del celular-puente (botón **Cobrar por SMS** del tendero).

## SMS real por Telnyx (sin celular conectado)

`POST /sms/telnyx` recibe el webhook de Telnyx, verifica la firma ed25519 (`telnyx-signature-ed25519` + `telnyx-timestamp`, ventana de 5 min), responde 200 de inmediato y envía la respuesta por `POST https://api.telnyx.com/v2/messages`. Usa el mismo despacho que `/sms/inbound`: un `VALE …` se liquida en el gateway y lo demás va al Asistente. Los reintentos de Telnyx (mismo id) se atienden una sola vez.

1. Portal de Telnyx: compra un número con SMS y asígnalo a un perfil de mensajería; en el perfil pon el webhook `https://paygent.up.railway.app/api/sms/telnyx` (API v2) y permite el país de destino (CO).
2. Variables (Railway o `.env`): `SMS_PROVIDER=telnyx`, `MOCK_SMS=0`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY` (Portal → Keys & Credentials → Public Key), `TELNYX_FROM_NUMBER` (E.164) y `TELNYX_MESSAGING_PROFILE_ID`.
3. Con `MOCK_SMS=1` el webhook funciona igual pero la respuesta solo queda en el log.

**Vales por SMS:** sin datos pero con señal, el tendero toca **Cobrar por SMS** en un vale pendiente (`VITE_APP_SMS_GATEWAY_NUMBER` = número del celular-puente). El vale viaja como `VALE <base64url>` (≈140 caracteres, un solo SMS): el certificado se busca por `certId` y el comercio por una huella de su wallet. `/sms/inbound` lo liquida por el mismo camino que `POST /vouchers/settle` (firma, replay, Guardián) y nunca lo pasa al LLM.
