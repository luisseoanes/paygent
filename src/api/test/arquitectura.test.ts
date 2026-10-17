import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Las reglas de capas de docs/arquitectura.md, comprobadas sobre los imports reales.
const SRC = resolve(import.meta.dirname, '../src')
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []))

const imports = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map(([, spec]) =>
    spec.startsWith('.') ? relative(SRC, resolve(file, '..', spec)) : spec,
  )

const layer = (prefix: string, except: (f: string) => boolean = () => false) =>
  files(SRC).filter((f) => relative(SRC, f).startsWith(prefix) && !except(relative(SRC, f)))

const offending = (fs: string[], forbidden: (spec: string) => boolean) =>
  fs.flatMap((f) => imports(f).filter(forbidden).map((spec) => `${relative(SRC, f)} → ${spec}`))

describe('Capas del api', () => {
  it('store/ (persistencia) no conoce el dominio, Open Payments ni HTTP', () => {
    expect(offending(layer('store/'), (s) => !s.startsWith('store/') && s !== 'env.ts' && !s.startsWith('@') && s !== 'pg' && !s.startsWith('node:'))).toEqual([])
  })

  it('op/ (adaptador de Open Payments) no conoce el dominio, la demo ni HTTP', () => {
    expect(offending(layer('op/'), (s) => /^(gateway|auth|demo|http|merchants|feed)\//.test(s) || s === 'fastify')).toEqual([])
  })

  it('el dominio del gateway no conoce HTTP, la autenticación ni la demo', () => {
    const domain = layer('gateway/', (f) => f.startsWith('gateway/routes/'))
    expect(offending(domain, (s) => s === 'fastify' || /^(auth|http|demo)\//.test(s) || s.includes('/routes'))).toEqual([])
  })

  it('las rutas no escriben SQL: pasan por los repositorios de store/', () => {
    const routes = files(SRC).filter((f) => /routes(\/|\.ts$)/.test(relative(SRC, f)))
    expect(routes.filter((f) => /\.query\(/.test(readFileSync(f, 'utf8'))).map((f) => relative(SRC, f))).toEqual([])
  })
})
