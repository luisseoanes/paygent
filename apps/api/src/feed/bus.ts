import { EventEmitter } from 'node:events'
import { randomId, type FeedEvent } from '@openroute/shared'
import { db, save } from '../db.ts'

const bus = new EventEmitter()
bus.setMaxListeners(100)

/** Publica un evento en el feed de Juan (persistido + SSE en vivo). */
export const emit = (e: Omit<FeedEvent, 'id' | 'at'>): FeedEvent => {
  const event: FeedEvent = { id: randomId('ev_'), at: new Date().toISOString(), ...e }
  db.feed.push(event)
  if (db.feed.length > 500) db.feed.splice(0, db.feed.length - 500)
  save()
  bus.emit('event', event)
  console.log(`[feed] ${event.kind} · ${event.actor.name} · ${event.reason ?? ''}`)
  return event
}

export const subscribe = (fn: (e: FeedEvent) => void) => {
  bus.on('event', fn)
  return () => bus.off('event', fn)
}
