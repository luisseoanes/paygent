# Paygent

**Delegable payment power for people and their AI agents — even without internet or a smartphone.**
Built on [Open Payments](https://openpayments.dev) for the Interledger hackathon.

- Production: <https://paygent.up.railway.app>
- Source: <https://github.com/luisseoanes/paygent>

## The problem

Open Payments assumes the payer has three things:

| Assumption | Who it leaves out |
|---|---|
| Internet on every payment | Rural areas with intermittent signal |
| A smartphone and a browser for consent | Older people with feature phones (SMS only) |
| Their own wallet | Family members spending someone else's money |

Current agentic payment schemes (card-network agents, closed wallets) make the same assumptions.

## The pitch

Juan, abroad, approves **one** Open Payments grant in his wallet: the **root mandate**. Paygent's
Mandate Gateway carves signed **sub-mandates** from it for people, devices and AI agents. His mother
texts an AI Assistant from a feature phone ("I need my blood-pressure pill"), confirms with a PIN, and
the pharmacy is paid straight from Juan's wallet. María pays the shop with no signal using a signed
voucher that settles later. A Guardian agent watches every peso and can only restrict. Nobody in the
middle holds the money.

> One mandate → people and agents spending inside it → at any connectivity level.

## The mandate tree

Limits only narrow down the tree: a child can never exceed its parent.

```text
Root mandate (Juan)                   $1,200,000 / month   ← real Open Payments grant
├── María                             $1,000,000
│   ├── Phone (offline vouchers)      $400,000 · offline cap $80,000 (ceiling $200,000)
│   ├── SMS                           $200,000 · PIN always
│   └── Assistant in the app          $160,000 · PIN above $40,000
├── Assistant (Doña Carmen, by SMS)   $160,000 / week · PIN above $40,000
│   └── Inventory agent               $2,000 · pays per query
└── Guardian                          $0 · cannot spend, can only restrict
```

Amounts are the demo seed, in COP (the currency of Juan's wallet).

## Three connectivity levels

| Level | How the person pays | What happens in Open Payments |
|---|---|---|
| Online | QR in the PWA | Immediate Outgoing Payment, payer → merchant |
| No signal | ed25519-signed voucher, verified offline by the shopkeeper | Settled when the shop reconnects (or by SMS) |
| Feature phone | SMS + PIN, talking to the AI Assistant | Outgoing Payment once the PIN is confirmed |

## Five agent rules (enforced in code, not prompts)

1. An agent is a leaf: it never spends beyond its sub-mandate.
2. Monotonicity: permissions only narrow down the tree.
3. Human in the loop: above a threshold, a PIN is required.
4. Non-custodial: every agent payment is a real Outgoing Payment from the payer's wallet.
5. Traceability: every action lands in the payer's feed with its "why".

Next: [Quickstart](quickstart.md) · [Architecture](architecture.md)
