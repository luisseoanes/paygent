// Envío de un SMS saliente: Telnyx, el celular por adb o un falso en pruebas son intercambiables.
export interface SmsSender {
  send(to: string, body: string): Promise<void>
}

/** MOCK_SMS=1: no sale nada al proveedor, solo queda en el log. */
export const logSender = (log: (msg: string) => void = console.log): SmsSender => ({
  async send(to, body) {
    log(`[sms:mock] → ${to}: ${body}`)
  },
})
