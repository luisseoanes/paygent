import { DEMO_PASSWORD } from '../src/demo/seed.ts'

// Cliente de los scripts contra la api corriendo: entra como Juan (titular de todo el árbol de la demo).
export const demoClient = async (api: string) => {
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'juan@paygent.dev', password: DEMO_PASSWORD }),
  })
  if (!login.ok) throw new Error(`login de Juan → ${login.status} ${await login.text()}`)
  const { token } = (await login.json()) as { token: string }

  return async <T = any>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`)
    return json as T
  }
}
