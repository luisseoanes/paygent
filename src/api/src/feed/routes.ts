import type { FastifyInstance } from 'fastify'
import { requireTitularOf } from '../auth/guards.ts'
import { inTree, recentEvents } from '../store/feed.ts'
import { DEMO_ROOT_ID } from '../demo/constants.ts'
import { subscribe } from './bus.ts'

// BE-FEED: la libreta del titular, solo con lo de su árbol (?root=; sin root, la demo). En vivo por SSE.
export default async function feedRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { root?: string } }>('/feed', async (req) => {
    const root = req.query.root ?? DEMO_ROOT_ID
    await requireTitularOf(req, root)
    return (await recentEvents(100, root)).reverse()
  })

  // EventSource no manda cabeceras: el token va en ?token=.
  app.get<{ Querystring: { root?: string; token?: string } }>('/feed/stream', async (req, reply) => {
    const root = req.query.root ?? DEMO_ROOT_ID
    await requireTitularOf(req, root)
    const backlog = await recentEvents(50, root)
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)
    for (const e of backlog) send(e)
    const unsubscribe = subscribe((e) => void inTree(e.mandateId, root).then((ok) => ok && send(e)))
    const ping = setInterval(() => res.write(': ping\n\n'), 15000)
    req.raw.on('close', () => {
      clearInterval(ping)
      unsubscribe()
    })
  })
}
