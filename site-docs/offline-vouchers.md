# Offline vouchers

A beneficiary's phone can pay with no signal. It signs a voucher; the shopkeeper verifies it
offline; the gateway settles it later as a real Outgoing Payment.

The crypto lives in `src/shared/src/crypto.ts` (tweetnacl, ed25519, canonical JSON) and runs
unchanged in Node and in the browser.

## Keys and certificates

| Object | Signed by | Contents |
|---|---|---|
| Mandate | Gateway | Everything except `spentInPeriod` / `periodStart` |
| Device certificate | Gateway | `certId`, `deviceKeyId`, `mandateId`, device `publicKey`, `offlineCap`, `issuedAt`, `expiresAt` |
| Voucher | Device | `voucherId`, certificate, `merchantWallet`, `category`, `amount`, `counter`, `cumulative`, `createdAt` |

1. The phone generates an ed25519 key pair and registers it: `POST /mandates/:id/device-key`.
2. The gateway returns a certificate (valid 7 days, never beyond the mandate) and its public key.
3. Each voucher increments `counter` (starts at 1) and `cumulative` (sum of all vouchers on this certificate).

## Offline verification (shopkeeper)

`verifyVoucherOffline` needs only the gateway public key:

- certificate signed by the gateway, and matches the voucher's `deviceKeyId`;
- voucher signed by the device key in the certificate;
- certificate not expired;
- same currency as the offline cap, positive amount;
- `amount ≤ cumulative ≤ offlineCap`.

## Settlement

When the shop reconnects: `POST /vouchers/settle` with a batch. For each voucher, in counter order:

| Step | On failure |
|---|---|
| Hard checks: offline verification, certificate known to the gateway, `certId:counter` not seen, `cumulative` consistent with the previous voucher, `createdAt` between the certificate's issue time and now (5 min skew), and the sum of the certificate's vouchers within its `offlineCap` even when counters are skipped | Rejected. A **replay** also freezes the device |
| Guardian review (`/guardian/evaluate`) | `flag` → settled but marked; `freeze` → rejected and device frozen |
| Gateway authorization (no PIN: the offline cap already bounded the risk) | Rejected |
| `executePayment` → Open Payments | Rejected with the error |

After the batch, the Guardian adjusts the offline cap of those phones. The phone gets the new cap in
its next certificate.

!!! note "Guardian down?"
    If the agents service does not answer, vouchers that passed the hard checks are approved.

## Settlement by SMS

With signal but no data, the shopkeeper taps **Cobrar por SMS**. The voucher travels as
`VALE <base64url>` in a single SMS (≈140 chars): the certificate is looked up by `certId` and the
merchant by a 4-byte hash of its wallet. `/sms/*` settles it through the same path as
`/vouchers/settle` and never passes it to the LLM.

## Double-spend bound

Offline, nobody can stop a phone from showing the same voucher to two shops. The bound is:

- **Per certificate:** at most `offlineCap` (enforced by `cumulative` in every signed voucher).
- **Detection:** the second presentation of `certId:counter` is rejected at settlement and the device is frozen.
- **Exposure:** the payer accepts losing up to the offline cap ceiling they set (e.g. $200,000).
  The phone starts at 40% of it and the Guardian moves it between 10% and 100%.
- **Online limits still apply:** settlement re-runs `authorize`, so the payer never pays more than
  the device branch's `maxDebit`. A rejected voucher is a loss for the shop, not the payer.

The phone requests a fresh certificate (counter and cumulative back to zero) whenever it has signal.
Older certificates stay valid until they expire. See [Security & limitations](security.md).
