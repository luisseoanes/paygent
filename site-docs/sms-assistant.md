# SMS & AI Assistant

A feature-phone user texts the Assistant in natural language. The Assistant searches, proposes and
asks for a PIN; the gateway pays.

## Message path

```text
phone ──SMS──► provider ──► api /sms/{inbound|smsgate|telnyx}
                              ├─ "VALE …"   → voucher settlement (never reaches the LLM)
                              └─ anything else → agents /assistant/message → tools → api /pay
```

All providers share one dispatcher (`src/api/src/sms/dispatch.ts`). Replies are capped at
`SMS_MAX_CHARS` (306 = 2 GSM-7 segments), cut at a full sentence.

## Providers

| Provider | Endpoint | Use it when | Verification |
|---|---|---|---|
| Simulated phone | `POST /sms/inbound` | Dev and demo (`/celular`) | — |
| SMS Gateway for Android | `POST /sms/smsgate` | Recommended in Colombia (an Android phone with a local SIM) | HMAC-SHA256 `X-Signature` over body + `X-Timestamp`, 5 min window |
| USB bridge (`pnpm sms:bridge`) | forwards to `/sms/inbound` | A phone plugged in via `adb` | Allow-list `SMS_BRIDGE_ALLOW` |
| Telnyx | `POST /sms/telnyx` | No phone available (no Colombian SMS numbers) | ed25519 `telnyx-signature-ed25519` + timestamp, 5 min window |

Webhook providers answer `200` immediately and send the reply through their API. Retries with the
same id are handled once.

## Set up SMS Gateway for Android

1. Install [SMS Gateway for Android](https://docs.sms-gate.app/) on the bridge phone. Enable
   **Cloud server** and note the username and password.
2. In **Settings → Webhooks**, copy the **Signing Key**.
3. Set the variables (Railway or `.env`):

    ```bash
    SMS_PROVIDER=smsgate
    MOCK_SMS=0
    SMSGATE_USERNAME=...
    SMSGATE_PASSWORD=...
    SMSGATE_SIGNING_KEY=...
    ```

4. Register the webhook:

    ```bash
    curl -u <user>:<password> -H 'content-type: application/json' \
      -d '{"url":"https://paygent.up.railway.app/api/sms/smsgate","event":"sms:received"}' \
      https://api.sms-gate.app/3rdparty/v1/webhooks
    ```

5. Set `VITE_APP_SMS_GATEWAY_NUMBER` to the bridge phone's number (the shopkeeper's **Cobrar por SMS** button).

## Other options

**USB bridge** (no cloud): enable USB debugging, check `adb devices`, set `SMS_BRIDGE_ALLOW`,
`SMS_BRIDGE_API`, `ADB_SERIAL` and `SMS_BRIDGE_SUB_ID` (`defaultSmsSubId` in `adb shell dumpsys isub`),
then `pnpm sms:bridge`. It only handles messages that arrive after it starts.

**Telnyx:** buy a number with SMS, point its messaging profile webhook (API v2) at
`https://paygent.up.railway.app/api/sms/telnyx`, allow the destination country, and set
`SMS_PROVIDER=telnyx`, `MOCK_SMS=0`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_FROM_NUMBER`.

## Privacy filter

With SMS Gateway for Android the bridge phone forwards **all** its SMS. Paygent only answers:

- numbers with an active SMS channel (a profile in the gateway), or
- a message that is a `VALE …` voucher.

Everything else is dropped without being logged. Short codes never get a reply.

## The PIN rule

!!! danger "The PIN never reaches the LLM"
    `src/agents/assistant/router.py` matches any 4–6 digit message first and sends it straight to
    `confirmar_pin` → `/pay` with `pendingId` + `pin`. The model never sees it.

- The SMS mode always requires a PIN (`pinThreshold = 0`): a sender number can be spoofed.
- The in-app Assistant asks for a PIN above $40,000 (or the mode's cap, if lower).
- "1 / 2" (pick up / deliver) and "NO" (cancel) are also handled deterministically.

## Deterministic fallback

| Condition | Who answers |
|---|---|
| `MOCK_LLM=1` or no `ANTHROPIC_API_KEY` | `assistant/rules.py` |
| LLM error or slower than `LLM_TIMEOUT_S` | `assistant/rules.py` (keeps any pending purchase) |
| Agents service down | The api replies "service unavailable" |

The LLM (Claude with tool use) can only call four tools: `buscar_producto`, `buscar_en_internet`,
`proponer_compra`, `consultar_saldo`. None of them moves money without the gateway.
