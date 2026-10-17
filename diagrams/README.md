# Pitch diagrams

Two slides for the 5-minute pitch. Each `.drawio` file is the editable source (open it in
[app.diagrams.net](https://app.diagrams.net)); the `.svg`/`.png` files are exports of it.
Palette: accent blue `#2563EB` + dark gray `#1F2937` on white.

## 1. Architecture (`architecture.svg`)

Speaker note (~30 s):
> "Juan, María, the shopkeeper and Doña Carmen reach Paygent through a web app that works offline or
> through plain SMS. Every payment passes through one place, the Mandate Gateway, which checks the
> limit, the category and the PIN. The AI agents only propose; they hold no keys and no money. The money
> goes straight from Juan's wallet to the merchant over Open Payments. Nothing in the middle holds it."

## 2. Payment flow (`payment-flow.svg`)

Speaker note (~30 s):
> "Juan approves one grant in his wallet, once. That's the root mandate. Then anyone he trusts can ask
> to pay: María taps Pay, Doña Carmen texts 'necesito la pastilla', or the shopkeeper scans a signed
> voucher. The gateway decides, and the Guardian can only tighten limits. Open Payments then creates
> the incoming payment, the quote and the outgoing payment from Juan's wallet. The merchant gets paid
> and Juan sees why in his feed. With no signal, the signed voucher is checked offline and settled later."

Light/dark transparent PNGs for the README: `python3 diagrams/variants.py diagrams/<name>.svg <out_dir>`, then render each SVG with headless Chrome (`--default-background-color=00000000`).
