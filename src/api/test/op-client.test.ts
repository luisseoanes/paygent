import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parsePrivateKey } from '../src/op/client.ts'

// OP_PRIVATE_KEY llega por variable de entorno (Railway): hay que aceptar las formas en que se suele pegar.
describe('parsePrivateKey', () => {
  const pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  it('acepta el PEM con saltos de línea reales', () => {
    expect(parsePrivateKey(pem).asymmetricKeyType).toBe('ed25519')
  })

  it('acepta el PEM en una sola línea con "\\n" escritos', () => {
    expect(parsePrivateKey(pem.replace(/\n/g, '\\n')).asymmetricKeyType).toBe('ed25519')
  })

  it('acepta el PEM en base64', () => {
    expect(parsePrivateKey(Buffer.from(pem).toString('base64')).asymmetricKeyType).toBe('ed25519')
  })

  it('falla con un mensaje claro si no es una llave', () => {
    expect(() => parsePrivateKey('no-es-una-llave')).toThrow(/OP_PRIVATE_KEY no es una llave privada/)
  })
})
