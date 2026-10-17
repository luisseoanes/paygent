# SMS & Offline Voucher Demo Instructions

> **Automated check first:** `pnpm sms:guia` runs every server-side step of this guide (Parts 1–3) against the
> running services and prints ✅/❌ per step. It resets the demo at the start and at the end, so never run it during
> the demo. Use `SMS_GUIA_PHONE=+57… pnpm sms:guia` to activate SMS for Phone A's real number.

**Phones:** 
* **Phone A:** Plays the mother who texts, and later the shopkeeper.
* **Phone B:** Plays María on her smartphone.
* **Laptop or Phone:** Plays Juan.

---

## Part 1: Juan turns on SMS for Phone A (2 min)

1. Open [https://paygent.up.railway.app/juan](https://paygent.up.railway.app/juan) and tap the **Juan** demo account, then **Iniciar sesión**.
2. Tap the **María** branch.
3. In *"SMS con el Asistente"*, tap **Activar SMS**. *(If it already shows a number, tap **Cambiar número o PIN** instead).*
4. **Celular:** Phone A's number.  
   **PIN:** 4 digits that aren't obvious (not `1234` or `0000`). Enter it again in **Confirma el PIN**.
5. The section should now show the number masked, like `+57 ••• ••• 1234`.

---

## Part 2: The mother texts the Assistant (Phone A, plain SMS, no app)

6. **Text `+57 305 435 3220`:** `cuánto me queda?` *(how much do I have left?)*
   * ✅ A reply with the remaining balance arrives within a few seconds.
7. **Text:** `necesito acetaminofén` *(I need paracetamol)*
   * ✅ It offers options with prices and asks for the PIN.
8. Reply with the wrong PIN 
   * ✅ It's rejected.
9. Reply with the right PIN 
   * ✅ It confirms the purchase. That's a real payment on the test network: Juan sees it at `/juan` under the María branch, with its reason.
   * ❌ *If nothing arrives within a minute, tell Roy, who can check the server logs.*

---

## Part 3: Offline voucher, cashed in by SMS (Phone B = María, Phone A = shopkeeper)

### With signal first:
10. **Phone B:** Open [https://paygent.up.railway.app/maria](https://paygent.up.railway.app/maria) and tap **María**, then **Iniciar sesión**. In **Código**, type `maria-device`, then tap **Enlazar** *(it usually links on its own right after signing in)*.
11. **Phone A:** Open [https://paygent.up.railway.app/tendero](https://paygent.up.railway.app/tendero) and tap **Tendero**, then **Iniciar sesión**. Open the scan screen once and allow the camera.

### Now without data:
12. **Phone B:** Turn on airplane mode and reload `/maria`. It should still open and show *"Sin señal"* (no signal). Tap **Pagar** → **Tienda Doña Rosa**, enter `2000` (type `2` then `000`), then **Generar vale**. A QR code appears.
13. **Phone A:** Turn off mobile data and Wi-Fi (do **not** turn on airplane mode, as the phone still needs SMS). Scan Phone B's QR code.
    * ✅ It shows `✓` and saves the voucher as pending.
    * ⚠️ *Note: The data has to be off before scanning. Otherwise the voucher is cashed in online on the spot and you won't test SMS.*
14. **Phone A:** Open the pending voucher and tap **Cobrar por SMS** *(cash in by SMS)*. The messaging app opens with a message starting `VALE …`, addressed to `+57 305 435 3220`. Send it.
    * ✅ The reply is: `"Vale liquidado: $2.000 COP a Tienda Doña Rosa"` *(voucher settled)*.
15. **Replay test:** Send that same `VALE …` text again.
    * ✅ The reply is: `"Vale rechazado: este vale ya se había cobrado"` *(voucher rejected: already cashed)*, and Juan's feed shows the Guardian freezing María's device.
16. Turn signal back on for both phones. At `/juan`, the feed shows the voucher settled.