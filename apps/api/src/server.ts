import { buildApp } from './app.ts'
import { db } from './db.ts'
import { env } from './env.ts'
import { payoutFor } from './gateway/payout.ts'
import { prewarm } from './op/settle.ts'

const app = await buildApp()
await app.listen({ port: env.PORT, host: '0.0.0.0' })

console.log(`
  OpenRoute api → http://localhost:${env.PORT}
  MOCK_OP=${env.MOCK_OP ? '1  ⚠️  Open Payments SIMULADO (nunca en la demo)' : '0  ✅ Open Payments real'}
  MOCK_SMS=${env.MOCK_SMS ? 1 : 0} · grant raíz: ${db.rootGrant ? 'sí' : 'no (abre /juan y aprueba)'}
`)

prewarm([...new Set(Object.values(db.merchants).map((m) => payoutFor(m.wallet).destination))]).catch(() => {})
