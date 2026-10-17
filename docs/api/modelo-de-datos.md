# Modelo de datos

La api guarda todo en **Postgres**. El esquema está en `src/api/src/store/migrations.ts`; el acceso, en
`src/api/src/store/*.ts` (un repositorio asíncrono por agregado; `store/mandates.ts` para el árbol) y `src/api/src/gateway/mandates.ts` (reglas del árbol).

- **Railway:** el servicio Postgres del proyecto (`DATABASE_URL=${{Postgres.DATABASE_URL}}`).
- **Local sin `DATABASE_URL`:** PGlite (Postgres embebido) en `src/api/.data/pglite`. Borrar la carpeta = empezar de cero.
- **Tests:** PGlite en memoria, uno por fichero de test.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `users` | Cuentas: nombre, apellido, documento, correo, contraseña (scrypt con salt), celular. Correo y contraseña son opcionales para quien solo usa SMS |
| `payers` | Quien delega: su wallet pública y la moneda de esa wallet. **Nunca** se guarda una llave suya |
| `root_grants` | El permiso que el titular firmó en su billetera (GNAP): token, URL de gestión y de continuación. Estado `pending → active → replaced/revoked` |
| `mandates` | El árbol. Montos en columnas, en la moneda del árbol; firma ed25519 del gateway; `holder_user_id` une la rama con la cuenta de su titular o beneficiario; `mode` marca las ramas de modo (`celular`, `asistente`, `sms`) y va firmado |
| `pins` | PIN por mandato (scrypt con salt). Se busca subiendo por la cadena |
| `agents` | Agentes (Asistente, Inventario, Guardián). Sin clave propia: el servicio usa `AGENT_SERVICE_KEY` |
| `merchants` | Quien solo recibe: dirección de cobro (la que firman los vales), a dónde llega el dinero (wallet o Puntored) y su dueño |
| `profiles` | Por dónde habla cada persona con el Asistente: su número de SMS o `app:<persona>` para el chat |
| `delivery_addresses` | Dirección de entrega por mandato raíz (solo la cambia el titular) |
| `device_keys`, `device_certs` | Celulares vinculados y sus certificados para pagar sin señal |
| `payments` | Cada pago: monto debitado, precio en la moneda del comercio, lo recibido, estado e id del outgoing payment |
| `pending_purchases` | Compras que esperan PIN |
| `vouchers` | Vales sin señal presentados; la clave `certificado:contador` detecta el doble gasto |
| `feed_events` | El feed; se ordena por `seq` y se filtra por el árbol de cada titular |
| `gateway_keys` | Llave ed25519 del gateway (firma mandatos y certificados) |
| `meta` | Versión de la semilla |

## Titulares y beneficiarios

- **Titular:** fila en `users` y en `payers`, más **su propio mandato raíz** (`root_<userId>`; la demo usa `root`).
  Su grant vive en `root_grants` ligado a esa raíz.
- **Beneficiario:** fila en `users`, enlazada (`mandates.holder_user_id`) a la rama que le creó su titular, y a la de
  su celular. El titular la crea con `POST /mandates/:raíz/beneficiaries` y le pasa el código. Sus modos de consumo
  (celular, Asistente, SMS) son ramas hijas: ver `docs/producto/modos-de-consumo.md`.
- **Moneda:** la de la wallet de cada titular. Todos los mandatos y pagos de su árbol van en ella.
- **Un pago** se hace con el grant de la raíz de la rama que paga.

## Cambios de esquema y semilla

- **Un cambio de esquema es una migración nueva** al final de `MIGRATIONS`. Una migración ya desplegada no se edita.
- **La semilla** (`demo/seed.ts`) solo borra y recrea **la demo de Juan**: el árbol `root`, sus cuentas de demo, sus
  vales y sus eventos. Las cuentas registradas, sus grants, los comercios y agentes dados de alta y la llave del
  gateway sobreviven.
- **`SEED_VERSION`:** súbela cuando cambie la semilla. Al desplegar, una base con otra versión se vuelve a sembrar
  y conserva el grant de Juan.
- **Migración desde el volumen:** en el primer arranque sobre una base vacía, se importa el grant de Juan del antiguo
  `.data/db.json` (`store/legacy.ts`).
