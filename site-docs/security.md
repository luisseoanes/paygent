# Security & limitations

## What is enforced

| Guarantee | Where |
|---|---|
| No spend beyond any mandate in the chain, category or period | `gateway/authorize.ts` (pure rules, unit-tested) |
| Children never exceed parents; Guardian can only restrict | `gateway/mandates.ts` (`restrict`, delegation invariants) |
| PIN above the threshold; 3 attempts per pending purchase; one confirmation pays once, even if sent twice at the same time | `gateway/pay.ts`, PINs stored salted and hashed |
| PIN never reaches the LLM ("1234", "PIN 1234"…; digits masked if mixed into another sentence) | `agents/assistant/router.py` |
| Delivery address comes from the payer, not the agent | `resolveDelivery` in `gateway/pay.ts` |
| Agents cannot change addresses, payouts, merchants or agents | `x-api-key` requests get 403 on those routes |
| Every route checks who calls: signed session token for people, service key + agent id for agents | `auth/session.ts` (HMAC, 7 days), `auth/guards.ts`; attacks covered in `test/auth.test.ts` |
| A payer only touches their own tree; a beneficiary only gets a certificate for their own phone | `requireTitularOf`, `requireMemberOf` |
| Two concurrent payments cannot read the same "available" | `gateway/spend.ts`: spend reserved under a chain row lock before paying, released if the payment fails (`pay-concurrente.test.ts`) |
| Restricting, freezing or re-limiting a branch never loses a spend reserved at the same time | Row locked before every full-row write (`gateway/mandates.ts`) |
| Login brute force is slowed: 5 failures per (IP, email) → 429 for 15 min; scrypt runs off the event loop | `auth/limiter.ts`, `gateway/pin.ts` |
| Unexpected errors return `Error interno (<request id>)`; session tokens are masked in api logs | `app.ts`, `http/log.ts` |
| Voucher and certificate signatures (ed25519) | `src/shared/src/crypto.ts` |
| Replay of a voucher is rejected and freezes the device | `vouchers/settle.ts` |
| SMS webhooks are signed (HMAC / ed25519, 5 min window) | `sms/smsgate.ts`, `sms/telnyx.ts` |
| Non-custodial: payer wallet → merchant, no intermediate account | `op/settle.ts` |

## Residual risks

!!! note "Sessions"
    `POST /auth/login` returns a token signed by the api (`Authorization: Bearer`; the SSE feed takes it in
    `?token=` because `EventSource` cannot send headers). The client cannot choose its account id. The demo
    accounts have a public password on purpose (one-click login for the jury): whoever signs in as Juan can do
    what Juan can, on test-network money.

| Risk | Bound today |
|---|---|
| **Offline double-spend.** A voucher shown to two shops offline is only detected at settlement | The second shop's voucher is rejected and the device frozen. Exposure per certificate is its `offlineCap`, within the payer's ceiling |
| **Several live certificates.** A new certificate resets counter and cumulative; old ones stay valid until expiry (7 days). Within one certificate the total is capped | Settlement re-runs `authorize`, so the payer never pays above the device branch's `maxDebit`; the loss falls on the shop |
| **Payer balance at settlement.** Limits are permissions, not reserved money. Open Payments does not expose the wallet balance | If funds are short, the wallet rejects the Outgoing Payment and nothing moves; an accepted offline voucher can still fail |
| **SMS sender spoofing.** `POST /sms/inbound` stays open for the simulated phone and the USB bridge | The SMS mode always requires a PIN; provider webhooks verify signatures. Turn the simulator off in production |
| **Network retry of a voucher.** Re-sending the exact same voucher (e.g. a lost response) is treated as a replay and freezes the device | Kept on purpose for the demo; the fix is to return the original result when the signature is identical |
| **Single api instance.** Feed bus, Open Payments token caches, SMS de-duplication and the login limiter live in memory | Fine for the demo; Postgres `LISTEN/NOTIFY` and a table would remove it |
| **Re-signing a revoked root starts empty** | Its revoked branches (and their payment rows) are deleted; archiving them would keep the history |
| **Guardian unavailable** | Hard checks still run; vouchers that pass them settle without review |
| **Late payment outcome** | The spend stays counted (safe side) and the feed shows the merchant was not paid |
| **In-memory state in agents** (sessions, used Inventory payment ids) | Lost on restart; conversations restart |

## Simulated in the demo

- The village shops' catalogue (products, prices, stock). Queries and purchases are paid for real.
- Puntored's final credit to a shopkeeper without a wallet (the payment to Puntored's wallet is real).
- Physical delivery.
- Guardian explanations are templates (its decisions are real rules).

## Secrets

- Never commit `.env`, `private.key` or `*.pem` (all git-ignored).
- On Railway the private key goes in `OP_PRIVATE_KEY`.
- `MOCK_OP` must be `0` in the demo; mock flags are for development only.
