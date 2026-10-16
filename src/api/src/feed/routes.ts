import type { FastifyInstance } from 'fastify'
import { recentEvents } from '../db.ts'
import { subscribe } from './bus.ts'

// BE-FEED: feed en vivo por Server-Sent Events.
export default async function feedRoutes(app: FastifyInstance) {
  app.get('/feed', async () => (await recentEvents(100)).reverse())

  app.get('/feed/stream', async (req, reply) => {
    const backlog = await recentEvents(50)
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
    const unsubscribe = subscribe(send)
    const ping = setInterval(() => res.write(': ping\n\n'), 15000)
    req.raw.on('close', () => {
      clearInterval(ping)
      unsubscribe()
    })
  })
}
