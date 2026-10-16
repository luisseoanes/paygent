import { describe, expect, it } from 'vitest'
import { createBridge, type SmsTransport } from '../src/sms-bridge/bridge.ts'
import { loadBridgeConfig } from '../src/sms-bridge/config.ts'
import { ismsCommand, parseRows, splitSms } from '../src/sms-bridge/adb.ts'

const YO = '+573054440000'
const DEMO = '+573001112233'

/** Celular falso: bandeja en memoria y registro de lo que se lee y se envía. */
const fakePhone = (inbox: { id: number; address: string; body: string }[] = []) => {
  const read: number[] = []
  const sent: { to: string; body: string }[] = []
  const transport: SmsTransport = {
    latestId: async () => Math.max(0, ...inbox.map((m) => m.id)),
    newMessages: async (after) => inbox.filter((m) => m.id > after).map(({ id, address }) => ({ id, address })),
    readBody: async (id) => (read.push(id), inbox.find((m) => m.id === id)!.body),
    send: async (to, body) => void sent.push({ to, body }),
  }
  return { inbox, read, sent, transport }
}

const setup = (inbox: { id: number; address: string; body: string }[] = [], reply = async (_f: string, b: string) => `eco: ${b}`) => {
  const phone = fakePhone(inbox)
  const forwarded: { from: string; body: string }[] = []
  const bridge = createBridge({
    transport: phone.transport,
    allow: [YO],
    alias: { [YO]: DEMO },
    forward: async (from, body) => (forwarded.push({ from, body }), reply(from, body)),
    log: () => {},
  })
  return { ...phone, forwarded, bridge }
}

describe('puente SMS: privacidad', () => {
  it('ignora todo lo que ya estaba en la bandeja al arrancar', async () => {
    const t = setup([{ id: 7, address: YO, body: 'viejo' }])
    await t.bridge.start()
    await t.bridge.tick()
    expect(t.forwarded).toEqual([])
    expect(t.read).toEqual([])
  })

  it('un remitente fuera de la lista: no lee el cuerpo, no reenvía, no responde', async () => {
    const t = setup()
    await t.bridge.start()
    t.inbox.push({ id: 1, address: '+573110000000', body: 'Su código del banco es 123456' })
    await t.bridge.tick()
    expect([t.read, t.forwarded, t.sent]).toEqual([[], [], []])
  })

  it('un código corto nunca pasa, aunque esté en la lista', async () => {
    const phone = fakePhone()
    const forwarded: string[] = []
    const bridge = createBridge({ transport: phone.transport, allow: ['85432'], alias: {}, forward: async (_f, b) => (forwarded.push(b), 'x'), log: () => {} })
    await bridge.start()
    phone.inbox.push({ id: 1, address: '85432', body: 'promo' })
    await bridge.tick()
    expect([phone.read, forwarded, phone.sent]).toEqual([[], [], []])
  })
})

describe('puente SMS: reenvío', () => {
  it('reenvía como el número demo y responde al número real', async () => {
    const t = setup()
    await t.bridge.start()
    t.inbox.push({ id: 1, address: '305 444 0000', body: 'cuánto me queda?' })
    await t.bridge.tick()
    expect(t.forwarded).toEqual([{ from: DEMO, body: 'cuánto me queda?' }])
    expect(t.sent).toEqual([{ to: '305 444 0000', body: 'eco: cuánto me queda?' }])
  })

  it('no procesa dos veces el mismo mensaje', async () => {
    const t = setup()
    await t.bridge.start()
    t.inbox.push({ id: 1, address: YO, body: 'hola' })
    await t.bridge.tick()
    await t.bridge.tick()
    expect(t.forwarded).toHaveLength(1)
  })

  it('su propia respuesta de vuelta (escribirse a sí mismo) no entra en bucle', async () => {
    const t = setup()
    await t.bridge.start()
    t.inbox.push({ id: 1, address: YO, body: 'hola' })
    await t.bridge.tick()
    t.inbox.push({ id: 2, address: YO, body: 'eco: hola' })
    await t.bridge.tick()
    expect(t.forwarded).toHaveLength(1)
    expect(t.sent).toHaveLength(1)
  })

  it('si la api falla, responde un aviso corto y sigue', async () => {
    const t = setup([], async () => {
      throw new Error('caída')
    })
    await t.bridge.start()
    t.inbox.push({ id: 1, address: YO, body: 'hola' })
    await t.bridge.tick()
    expect(t.sent[0]!.body).toMatch(/no está disponible/)
  })
})

describe('puente SMS: configuración', () => {
  it('lee lista, alias, api e intervalo del entorno', () => {
    const c = loadBridgeConfig({
      SMS_BRIDGE_ALLOW: '+573054440000, +573009998877',
      SMS_BRIDGE_ALIAS: '+573054440000=+573001112233',
      SMS_BRIDGE_API: 'https://paygent.up.railway.app/api/',
      SMS_BRIDGE_POLL_MS: '2000',
      ADB_SERIAL: 'ABC',
    })
    expect(c).toMatchObject({
      allow: ['+573054440000', '+573009998877'],
      alias: { '+573054440000': '+573001112233' },
      api: 'https://paygent.up.railway.app/api',
      pollMs: 2000,
      adb: { serial: 'ABC', path: 'adb', subId: 1, ismsCode: 8 },
    })
  })

  it('sin lista de permitidos no arranca', () => expect(() => loadBridgeConfig({})).toThrow(/SMS_BRIDGE_ALLOW/))
})

describe('transporte adb', () => {
  it('parte un texto largo en segmentos de SMS', () => {
    expect(splitSms('hola')).toEqual(['hola'])
    expect(splitSms('a'.repeat(160))).toHaveLength(1)
    expect(splitSms('a'.repeat(161)).map((p) => p.length)).toEqual([153, 8])
    // á no es GSM-7: el SMS va en UCS-2 (70 / 67 caracteres)
    expect(splitSms('á'.repeat(71)).map((p) => p.length)).toEqual([67, 4])
  })

  it('lee las filas de content query', () => {
    const out = 'Row: 0 _id=12, address=+573054440000\nRow: 1 _id=13, address=85432\n'
    expect(parseRows(out)).toEqual([
      { _id: '12', address: '+573054440000' },
      { _id: '13', address: '85432' },
    ])
    expect(parseRows('No result found.\n')).toEqual([])
  })

  it('arma el service call de isms con comillas seguras', () => {
    expect(ismsCommand({ subId: 2, ismsCode: 8 }, '+573054440000', ["l'agua", 'b'])).toBe(
      "service call isms 8 i32 2 s16 'com.android.shell' i32 -1 s16 '+573054440000' i32 -1 i32 2 s16 'l'\\''agua' s16 'b' i32 -1 i32 -1 i32 1 i64 0",
    )
  })
})
