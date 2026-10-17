# Agentes, Guardián, Puntored y billetera (Luis, 16/10) · reconstrucción

> **No es texto literal.** Los prompts de estas sesiones no se conservaron. Cada entrada reconstruye, a partir del
> commit que produjo, qué se le pidió a Claude Code (Claude Opus 5.5). El commit es la fuente verificable. Los prompts
> literales de Luis del 17/10 están en [produccion-y-diagnostico.md](produccion-y-diagnostico.md).

17 entradas · 16/10 · Claude Code (Claude Opus 5.5).

Código afectado: `src/agents/` (Asistente, Inventario, Guardián, intención), `src/api/src/gateway/`, `src/api/src/op/`,
`src/api/src/merchants/`, `src/web/src/features/billetera/`.

## 1. 16/10 11:01 · `23b0893`

Arma el monorepo de Paygent: api en TypeScript con el gateway de mandatos sobre Open Payments, paquete compartido con
tipos y firmas ed25519, servicio de agentes en FastAPI (Asistente, Inventario, Guardián y compilador de intención) y
la web.

## 2. 16/10 12:33 · `1d050d4`

Añade el domicilio (recoger o enviar a casa), el cobro a comercios por Puntored y un umbral de PIN de unos $10:
debajo, el Asistente paga sin preguntar.

## 3. 16/10 13:12 · `a48dd03`

Crea un agente que busque el producto en internet y devuelva tiendas y precios, sin pagar nada.

## 4. 16/10 13:20 · `b450c1f`

El cobro en pesos falla cuando la wallet de Juan está en dólares. Arréglalo, pon el umbral de PIN configurable en
Railway y conecta la búsqueda en internet al Asistente.

## 5. 16/10 13:26 · `8786932`

Que el PIN y los topes se decidan con el débito real cotizado por Open Payments, no con una tasa supuesta. Haz un
`fx-probe` que mida la tasa del Test Wallet.

## 6. 16/10 13:31 · `da49d5d`

La búsqueda en internet tarda demasiado: tope de 5 s por tienda y como máximo 10 resultados.

## 7. 16/10 15:50 · `e60fbe1`

El agente tiene que buscar primero lo más cercano a la persona, con su ubicación.

## 8. 16/10 15:53 · `6d7f679`

Incluye en el repo la zona de la demo (datos de OpenStreetMap) para que funcione sin red, y añade un tercer servidor
de Overpass de respaldo.

## 9. 16/10 15:56 · `c265322`

Que el Asistente con Claude nombre las tiendas de la más cercana a la más lejana.

## 10. 16/10 15:59 · `d3cdb7a`

En la respuesta de búsqueda deja solo tienda, distancia y precio, para que quepa en un SMS.

## 11. 16/10 16:26 · `052772e`

Revisa la lógica del Guardián, corrige lo que esté mal y añade un chequeo en vivo de todas sus reglas.

## 12. 16/10 17:32 · `fd36337`

Que el tope sin señal de cada celular lo administre el Guardián: arranca bajo, sube con buen uso y baja con alertas,
siempre dentro del techo del titular. Saca "Gobierno" y la voz del pitch, y actualiza la sección de qué es real.

## 13. 16/10 20:02 · `2b2ecd5`

La billetera tiene que mostrar el saldo de la persona (no solo el de su celular), su propio celular y la TRM del día.

## 14. 16/10 22:11 · `f1b7e59`

El Asistente tiene que servir para cualquier beneficiario, no solo para la demo, con las reglas de Paygent en el
prompt. Escribe una guía SMS que se pueda verificar paso a paso con un script.

## 15. 16/10 22:39 · `70813c2`

Tres arreglos: el PIN se bloquea tras varios fallos, un vale se cobra una sola vez aunque llegue por la app y por SMS
a la vez, y al revocar una rama su número de SMS queda libre.

## 16. 16/10 22:45 · `6fd7a0c`

Si la api no da la TRM cuando arrancan los agentes, que reintenten al minuto en vez de esperar una hora.

## 17. 16/10 23:22 · `2a57a9a`

El tendero tiene que poder registrarse y cobrar sin wallet: Puntored le acredita a su llave Bre-B (simulado), con su
historial de acreditaciones en la caja.
