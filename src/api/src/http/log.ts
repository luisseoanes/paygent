import type { FastifyRequest } from 'fastify'

// El SSE manda el token de sesión en ?token= (EventSource no admite cabeceras): nunca debe quedar en los logs.
export const redactUrl = (url: string) => url.replace(/([?&]token=)[^&#]*/gi, '$1[oculto]')

/** Como el serializador por defecto de Fastify, pero con la url sin secretos. */
export const reqSerializer = (req: FastifyRequest) => ({
  method: req.method,
  url: redactUrl(req.url),
  host: req.host,
  remoteAddress: req.ip,
  remotePort: req.socket?.remotePort,
})
