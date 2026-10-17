import { EventEmitter } from 'node:events'
import { randomId, type FeedEvent } from '@openroute/shared'
import { insertEvent } from '../store/feed.ts'

const bus = new EventEmitter()
bus.setMaxListeners(100)

/** Publica un evento en el feed de Juan: se guarda (feed_events) y sale en vivo por SSE. */
export const emit = async (e: Omit<FeedEvent, 'id' | 'at'>): Promise<FeedEvent> => {
  const event: FeedEvent = { id: randomId('ev_'), at: new Date().toISOString(), ...e }
  await insertEvent(event)
  bus.emit('event', event)
  console.log(`[feed] ${event.kind} · ${event.actor.name} · ${event.reason ?? ''}`)
  return event
}

export const subscribe = (fn: (e: FeedEvent) => void) => {
  bus.on('event', fn)
  return () => bus.off('event', fn)
}
