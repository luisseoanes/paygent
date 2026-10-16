import type { FastifyInstance } from 'fastify'
import { inTree, recentEvents } from '../db.ts'
import { subscribe } from './bus.ts'

// BE-FEED: feed en vivo por Server-Sent Events.
export default async function feedRoutes(app: FastifyInstance) {
  // ?root=<mandato raíz>: solo lo del árbol de ese titular. Sin root, todo (la demo).
  app.get<{ Querystring: { root?: string } }>('/feed', async (req) => (await recentEvents(100, req.query.root)).reverse())

  app.get<{ Querystring: { root?: string } }>('/feed/stream', async (req, reply) => {
    const root = req.query.root
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
    const unsubscribe = subscribe((e) => {
      if (!root) return send(e)
      void inTree(e.mandateId, root).then((ok) => ok && send(e))
    })
    const ping = setInterval(() => res.write(': ping\n\n'), 15000)
    req.raw.on('close', () => {
      clearInterval(ping)
      unsubscribe()
    })
  })
}
