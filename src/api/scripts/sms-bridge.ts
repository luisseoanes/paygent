/**
 * Puente SMS por adb: tu celular Android (USB) recibe y envía los SMS reales de la demo.
 *   pnpm sms:bridge
 * Solo reenvía números de SMS_BRIDGE_ALLOW. Ver docs/operacion/sms.md → "SMS real con tu celular".
 */
import { resolve } from 'node:path'
import { adbTransport } from '../src/sms-bridge/adb.ts'
import { createBridge } from '../src/sms-bridge/bridge.ts'
import { loadBridgeConfig } from '../src/sms-bridge/config.ts'

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
} catch {
  // Sin .env: se usan las variables de la línea de comandos.
}

const cfg = loadBridgeConfig(process.env)
const log = (msg: string) => console.log(`[sms-bridge ${new Date().toLocaleTimeString('es-CO')}] ${msg}`)

const forward = async (From: string, Body: string) => {
  const res = await fetch(`${cfg.api}/sms/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ From, Body }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return ((await res.json()) as { reply: string }).reply
}

const bridge = createBridge({ transport: adbTransport(cfg.adb), allow: cfg.allow, alias: cfg.alias, forward, log })
log(`api ${cfg.api} · ${cfg.allow.length} número(s) permitido(s) · cada ${cfg.pollMs} ms`)
await bridge.start()

for (;;) {
  try {
    await bridge.tick()
  } catch (err) {
    log(`error leyendo el celular: ${(err as Error).message}`)
  }
  await new Promise((r) => setTimeout(r, cfg.pollMs))
}
