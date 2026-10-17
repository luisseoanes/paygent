// JSON Schema de los cuerpos (Fastify los valida antes del handler). Solo forma y tipos: las reglas de negocio, con
// sus mensajes para la web, siguen en el dominio.

const str = { type: 'string' } as const
const category = { type: 'string', enum: ['mercado', 'farmacia', 'efectivo', 'datos'] } as const

export const amountSchema = {
  type: 'object',
  required: ['value', 'assetCode', 'assetScale'],
  properties: {
    value: { type: 'string', pattern: '^\\d+$' },
    assetCode: { type: 'string', pattern: '^[A-Z]{3}$' },
    assetScale: { type: 'integer', minimum: 0, maximum: 9 },
  },
} as const

const deliveryRequest = {
  type: 'object',
  required: ['mode'],
  properties: { mode: { type: 'string', enum: ['pickup', 'delivery'] }, code: str, fee: amountSchema },
} as const

export const payBody = {
  type: 'object',
  required: ['mandateId'],
  anyOf: [{ required: ['pendingId'] }, { required: ['merchantWallet', 'amount', 'category', 'reason'] }],
  properties: {
    mandateId: str,
    merchantWallet: str,
    amount: amountSchema,
    price: amountSchema,
    category,
    reason: { type: 'string', maxLength: 500 },
    pin: str,
    pendingId: str,
    delivery: deliveryRequest,
  },
} as const

export const vouchersBody = {
  type: 'object',
  required: ['vouchers'],
  properties: {
    vouchers: {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        required: ['voucherId', 'deviceKeyId', 'deviceCert', 'merchantWallet', 'category', 'amount', 'counter', 'cumulative', 'createdAt', 'signature'],
        properties: {
          voucherId: str,
          deviceKeyId: str,
          deviceCert: { type: 'object', required: ['certId', 'mandateId', 'signature'] },
          merchantWallet: str,
          category,
          amount: amountSchema,
          counter: { type: 'integer', minimum: 1 },
          cumulative: amountSchema,
          createdAt: str,
          signature: str,
        },
      },
    },
  },
} as const

export const delegateBody = {
  type: 'object',
  required: ['holderType', 'holderId', 'maxDebit'],
  properties: {
    id: str,
    holderType: { type: 'string', enum: ['person', 'device', 'agent'] },
    holderId: str,
    holderName: str,
    maxDebit: amountSchema,
    pinThreshold: amountSchema,
    offlineCap: amountSchema,
    offlineCapCeiling: amountSchema,
    categories: { type: 'array', items: category },
    interval: str,
    expiresAt: str,
    canSpend: { type: 'boolean' },
    mode: { type: 'string', enum: ['celular', 'asistente', 'sms'] },
  },
} as const

export const beneficiaryBody = {
  type: 'object',
  properties: { alias: str, maxDebit: amountSchema, offlineCap: amountSchema, pin: str },
} as const

export const limitsBody = {
  type: 'object',
  properties: { maxDebit: amountSchema, offlineCap: amountSchema },
} as const

export const modesBody = {
  type: 'object',
  properties: {
    budget: amountSchema,
    limits: {
      type: 'array',
      items: { type: 'object', required: ['mandateId'], properties: { mandateId: str, maxDebit: amountSchema, offlineCap: amountSchema } },
    },
  },
} as const

export const restrictBody = {
  type: 'object',
  properties: { offlineCap: amountSchema, frozen: { type: 'boolean' } },
} as const

export const smsBody = { type: 'object', properties: { phone: str, pin: str } } as const
export const deviceKeyBody = { type: 'object', required: ['publicKey'], properties: { publicKey: str } } as const
export const addressBody = { type: 'object', properties: { recipientName: str, address: str } } as const

export const merchantBody = {
  type: 'object',
  properties: { id: str, name: str, category: str, wallet: str, payout: { type: 'object' } },
} as const

export const payoutBody = { type: 'object', properties: { via: str, wallet: str, llave: str } } as const

export const agentBody = {
  type: 'object',
  properties: { id: str, name: str, role: str, walletAddress: str },
} as const
