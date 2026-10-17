# Security & limitations

## What is enforced

| Guarantee | Where |
|---|---|
| No spend beyond any mandate in the chain, category or period | `gateway/authorize.ts` (pure rules, unit-tested) |
| Children never exceed parents; Guardian can only restrict | `gateway/mandates.ts` (`restrict`, delegation invariants) |
| PIN above the threshold; 3 attempts per pending purchase | `gateway/pay.ts`, PINs stored salted and hashed |
| PIN never reaches the LLM | `agents/assistant/router.py` |
| Delivery address comes from the payer, not the agent | `resolveDelivery` in `gateway/pay.ts` |
| Agents cannot change addresses, payouts, merchants or agents | `x-api-key` requests get 403 on those routes |
| Voucher and certificate signatures (ed25519) | `src/shared/src/crypto.ts` |
| Replay of a voucher is rejected and freezes the device | `vouchers/settle.ts` |
| SMS webhooks are signed (HMAC / ed25519, 5 min window) | `sms/smsgate.ts`, `sms/telnyx.ts` |
| Non-custodial: payer wallet → merchant, no intermediate account | `op/settle.ts` |

## Residual risks

!!! warning "Payer authentication is header-based"
    `POST /auth/login` validates the account but issues **no session token** yet. Payer-only routes
    trust the `x-user-id` header, and several dashboard routes are open. Anyone who knows an account
    id can act as that payer. Fix before any real use: issue and verify a session token.

| Risk | Bound today |
|---|---|
| **Offline double-spend.** A voucher shown to two shops offline is only detected at settlement | The second shop's voucher is rejected and the device frozen. Exposure per certificate is its `offlineCap`, within the payer's ceiling |
| **Several live certificates.** A new certificate resets counter and cumulative; old ones stay valid until expiry (7 days) | Settlement re-runs `authorize`, so the payer never pays above the device branch's `maxDebit`; the loss falls on the shop |
| **Payer balance at settlement.** Limits are permissions, not reserved money. Open Payments does not expose the wallet balance | If funds are short, the wallet rejects the Outgoing Payment and nothing moves; an accepted offline voucher can still fail |
| **SMS sender spoofing** | The SMS mode always requires a PIN |
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
