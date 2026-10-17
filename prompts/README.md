# Registro de prompts

Texto literal de los prompts de programación enviados a Claude Code (Claude Opus 5.5), un fichero por sesión. Lo
declara [`AI_USAGE.md`](../AI_USAGE.md).

| Fichero | Sesión | Áreas |
|---|---|---|
| [01-op-persistencia-y-cuentas.md](01-op-persistencia-y-cuentas.md) | 16/10, mañana y tarde | Open Payments real, despliegue, Postgres, varios titulares, alta de beneficiarios, docs |
| [02-sms-proveedores.md](02-sms-proveedores.md) | 16/10, tarde | Pruebas de proveedores de SMS (Twilio, Telnyx) |
| [03-modos-de-consumo-y-topes.md](03-modos-de-consumo-y-topes.md) | 16/10, noche | Modos de consumo, reparto de topes, grant menor, cierre de sesión, docs |

Cómo leerlos:

- **Literales**, salvo los datos personales y de autorización, sustituidos por `[…]` (celular, ids de cuentas de
  producción, nombres, el `hash` y el `interact_ref` de un callback de GNAP, el nombre interno del proyecto de Railway).
- Las capturas de pantalla aparecen como `[Image #N]`: no se incluyen.
- Los reenvíos idénticos seguidos se muestran una vez («enviado N veces»); se omiten los avisos de interrupción y los
  comandos de la interfaz (`/theme`). El contenido pegado va en bloques de texto.
- Horas en hora de Colombia (UTC−5).
- Cada miembro del equipo añade aquí los prompts de sus sesiones con el mismo formato.
