import { buildApp } from './app.ts'
import { getActiveGrant, listMerchants } from './db.ts'
import { env } from './env.ts'
import { ROOT_ID } from './gateway/mandates.ts'
import { payoutFor } from './gateway/payout.ts'
import { prewarm } from './op/settle.ts'

const app = await buildApp()
await app.listen({ port: env.PORT, host: '0.0.0.0' })

console.log(`
  Paygent api → http://localhost:${env.PORT}
  MOCK_OP=${env.MOCK_OP ? '1  ⚠️  Open Payments SIMULADO (nunca en la demo)' : '0  ✅ Open Payments real'}
  MOCK_SMS=${env.MOCK_SMS ? 1 : 0} · grant raíz: ${(await getActiveGrant(ROOT_ID)) ? 'sí' : 'no (abre /juan y aprueba)'}
  Base de datos: ${process.env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'PGlite local (.data/pglite)'}
`)

const destinations = await Promise.all((await listMerchants()).map(async (m) => (await payoutFor(m.wallet)).destination))
prewarm([...new Set(destinations)]).catch(() => {})
