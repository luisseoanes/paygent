# Registro de prompts

Texto literal de los prompts de programación enviados a Claude Code (Claude Opus 5.5), un fichero por área de trabajo.
Lo declara [`AI_USAGE.md`](../AI_USAGE.md).

| Fichero | Área | Prompts |
|---|---|---|
| [backend-open-payments.md](backend-open-payments.md) | Open Payments real: credenciales, wallets, grant y `/callback`, token, cobros que llegan, saldos | 20 |
| [backend-gateway-y-persistencia.md](backend-gateway-y-persistencia.md) | Gateway, modelo de datos en Postgres, titulares y beneficiarios, modos de consumo, topes | 16 |
| [frontend-pwa.md](frontend-pwa.md) | PWA: vales sin señal, reparto de topes, cierre de sesión, caja del tendero, enlace con código | 18 |
| [sms-y-agentes.md](sms-y-agentes.md) | Pagar sin datos, proveedores de SMS, tope y PIN del Asistente | 9 |
| [arquitectura-y-calidad.md](arquitectura-y-calidad.md) | Arquitectura por capas del backend y auditoría del código | 6 |
| [despliegue-y-entorno.md](despliegue-y-entorno.md) | Railway, variables de entorno, workflow de la documentación, `.gitignore` | 13 |
| [documentacion-y-politica-ia.md](documentacion-y-politica-ia.md) | `AI_USAGE.md`, este registro, `CLAUDE.md`, `docs/` y `README.md` | 16 |

Cada prompt indica su sesión y su hora:

| Sesión | Fecha y hora | Áreas |
|---|---|---|
| S1 | 16/10, 11:10–17:16 | Open Payments, despliegue, persistencia, cuentas, documentación |
| S2 | 16/10, 14:57–16:38 | SMS |
| S3 | 16/10, 17:19–20:49 | Modos de consumo y topes, frontend, documentación |
| S4 | 16/10 21:17 – 17/10 06:46 | Arquitectura, workflow de documentación, frontend del tendero y del vale |
| S5 | 17/10, 07:44–08:34 | Auditoría del código |
| S6 | 17/10, 09:35–09:44 | Este registro y `AI_USAGE.md` |

Cómo leerlos:

- **Literales**, salvo los datos personales y de autorización, sustituidos por `[…]` (celular, ids de cuentas de
  producción, nombres, el `hash` y el `interact_ref` de un callback de GNAP, el nombre interno del proyecto de Railway).
- Las respuestas cortas («haz commit y push», «continúa donde lo dejaste») van en el área de la petición que continúan.
- Las capturas de pantalla aparecen como `[Image #N]`: no se incluyen.
- Los reenvíos idénticos seguidos se muestran una vez («enviado N veces»); se omiten los avisos de interrupción, los
  comandos de la interfaz (`/theme`), las notificaciones de tareas en segundo plano y los resúmenes automáticos al
  continuar una sesión. El contenido pegado va en bloques de texto.
- Horas en hora de Colombia (UTC−5).
- Cada miembro del equipo añade aquí los prompts de sus sesiones con el mismo formato.
