// Configuración del puente SMS: todo sale del entorno (.env o línea de comandos).

export interface AdbConfig {
  path: string
  serial?: string
  /** Suscripción (SIM) que envía; ver defaultSmsSubId en `adb shell dumpsys isub` */
  subId: number
  /** Código de ISms.sendMultipartTextForSubscriber (8 en Android 14–16) */
  ismsCode: number
}

export interface BridgeConfig {
  api: string
  allow: string[]
  alias: Record<string, string>
  pollMs: number
  adb: AdbConfig
}

const list = (v = '') =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const loadBridgeConfig = (env: Record<string, string | undefined>): BridgeConfig => {
  const allow = list(env.SMS_BRIDGE_ALLOW)
  if (allow.length === 0) throw new Error('Falta SMS_BRIDGE_ALLOW: sin lista de números permitidos el puente no arranca')
  return {
    api: (env.SMS_BRIDGE_API || 'http://localhost:3001').replace(/\/+$/, ''),
    allow,
    alias: Object.fromEntries(list(env.SMS_BRIDGE_ALIAS).map((pair) => pair.split('=').map((s) => s.trim()))),
    pollMs: Number(env.SMS_BRIDGE_POLL_MS || 3000),
    adb: {
      path: env.ADB_PATH || 'adb',
      serial: env.ADB_SERIAL || undefined,
      subId: Number(env.SMS_BRIDGE_SUB_ID || 1),
      ismsCode: Number(env.SMS_BRIDGE_ISMS_CODE || 8),
    },
  }
}
