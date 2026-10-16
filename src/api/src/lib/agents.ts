import { env } from '../env.ts'

/** POST JSON al servicio Python de agentes. Devuelve null si no responde (la api sigue funcionando). */
export const callAgents = async <T>(path: string, body: unknown, timeoutMs = 15000): Promise<T | null> => {
  try {
    const res = await fetch(`${env.AGENTS_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[agents] ${path} no disponible: ${(err as Error).message}`)
    return null
  }
}
