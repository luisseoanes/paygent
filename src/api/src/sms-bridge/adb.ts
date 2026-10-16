import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SmsTransport } from './bridge.ts'
import type { AdbConfig } from './config.ts'

// Transporte por adb: lee la bandeja con `content query` y envía con el servicio isms (SMS real, sin app).

const run = promisify(execFile)

// Alfabeto GSM-7 básico: si todo el texto cabe, el SMS lleva 160 caracteres; si no, va en UCS-2 (70).
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/

export const splitSms = (text: string): string[] => {
  const [single, part] = GSM7.test(text) ? [160, 153] : [70, 67]
  const chars = [...text]
  if (chars.length <= single) return [text]
  const parts = []
  for (let i = 0; i < chars.length; i += part) parts.push(chars.slice(i, i + part).join(''))
  return parts
}

/** "Row: 0 _id=12, address=+57…" → [{ _id: '12', address: '+57…' }] (solo para columnas sin comas) */
export const parseRows = (out: string) =>
  out
    .split('\n')
    .filter((l) => l.startsWith('Row: '))
    .map((l) => Object.fromEntries(l.replace(/^Row: \d+ /, '').split(', ').map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)])))

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** ISms.sendMultipartTextForSubscriber(subId, pkg, tag, dest, sc, parts, sentIntents, deliveryIntents, persist, messageId) */
export const ismsCommand = ({ subId, ismsCode }: Pick<AdbConfig, 'subId' | 'ismsCode'>, to: string, parts: string[]) =>
  [
    `service call isms ${ismsCode} i32 ${subId} s16 ${q('com.android.shell')} i32 -1 s16 ${q(to)} i32 -1`,
    `i32 ${parts.length} ${parts.map((p) => `s16 ${q(p)}`).join(' ')}`,
    'i32 -1 i32 -1 i32 1 i64 0',
  ].join(' ')

export const adbTransport = (cfg: AdbConfig): SmsTransport => {
  const shell = async (cmd: string) => {
    const args = [...(cfg.serial ? ['-s', cfg.serial] : []), 'shell', cmd]
    return (await run(cfg.path, args, { maxBuffer: 4 * 1024 * 1024 })).stdout
  }
  const inbox = (projection: string, where: string) =>
    shell(`content query --uri content://sms/inbox --projection ${projection} --where ${q(where)}`)

  return {
    async latestId() {
      return Math.max(0, ...parseRows(await inbox('_id', '_id>0')).map((r) => Number(r._id)))
    },
    async newMessages(afterId) {
      return parseRows(await inbox('_id:address', `_id>${Math.floor(afterId)}`)).map((r) => ({ id: Number(r._id), address: r.address ?? '' }))
    },
    async readBody(id) {
      const out = await inbox('body', `_id=${Math.floor(id)}`)
      return out.replace(/^Row: 0 body=/, '').replace(/\n$/, '')
    },
    async send(to, body) {
      const out = await shell(ismsCommand(cfg, to, splitSms(body)))
      // Sin excepción el Parcel empieza en 00000000; si no, Android rechazó el envío.
      if (!/Result: Parcel\(\s*(0x00000000: )?00000000/.test(out)) throw new Error(`isms rechazó el envío: ${out.trim()}`)
    },
  }
}
