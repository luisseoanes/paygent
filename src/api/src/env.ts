import { resolve } from 'node:path'

// Un solo .env en la raíz del repo para api y agents.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'))
} catch {
  console.warn('[env] No hay .env en la raíz: usando valores por defecto (todo en mock). Copia .env.example → .env')
}

const flag = (name: string, def: boolean) => {
  const v = process.env[name]
  return v === undefined || v === '' ? def : v === '1' || v.toLowerCase() === 'true'
}
const str = (name: string, def = '') => process.env[name] || def

export const env = {
  MOCK_OP: flag('MOCK_OP', true),
  MOCK_SMS: flag('MOCK_SMS', true),
  MOCK_INVENTORY_PAYMENT: flag('MOCK_INVENTORY_PAYMENT', false),
  /** 'telnyx' habilita POST /sms/telnyx; las llaves TELNYX_* se leen en sms/telnyx.ts */
  SMS_PROVIDER: str('SMS_PROVIDER', 'twiml'),

  PORT: Number(str('API_PORT', '3001')),
  PUBLIC_API_URL: str('PUBLIC_API_URL', 'http://localhost:3001'),
  AGENTS_URL: str('AGENTS_URL', 'http://localhost:8000'),
  WEB_URL: str('WEB_URL', 'http://localhost:5173'),

  OP_CLIENT_WALLET: str('OP_CLIENT_WALLET'),
  OP_KEY_ID: str('OP_KEY_ID'),
  OP_PRIVATE_KEY_PATH: resolve(import.meta.dirname, '../../..', str('OP_PRIVATE_KEY_PATH', './private.key')),
  /** Contenido de private.key (PEM o PEM en base64). Si está, tiene prioridad sobre OP_PRIVATE_KEY_PATH. Para Railway. */
  OP_PRIVATE_KEY: str('OP_PRIVATE_KEY'),

  /** Respaldo si la TRM del día no se puede consultar (y la tasa fija con MOCK_FX=1). */
  FX_COP_PER_USD: Number(str('FX_COP_PER_USD', '4000')),
  /** 1 = no consulta la TRM y usa FX_COP_PER_USD. En los tests vale 1 por defecto. */
  MOCK_FX: flag('MOCK_FX', !!process.env.VITEST),
  FX_TRM_URL: str('FX_TRM_URL', 'https://www.datos.gov.co/resource/32sa-8pi3.json'),

  /** Credencial única del servicio de agentes (src/agents). Los agentes son filas de la tabla agents. */
  AGENT_SERVICE_KEY: str('AGENT_SERVICE_KEY', 'dev-agents-key'),
  /** Firma los tokens de sesión. Vacío: se deriva de la llave del gateway (estable mientras la base no cambie). */
  SESSION_SECRET: str('SESSION_SECRET'),

  DATA_DIR: resolve(import.meta.dirname, '../.data'),
}
