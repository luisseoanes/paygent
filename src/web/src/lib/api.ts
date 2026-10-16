import { useEffect, useState } from 'react'
import type { FeedEvent } from '@openroute/shared'

// Todo pasa por el proxy de Vite: /api → apps/api, /agents → agents.

const request = async <T,>(base: string, path: string, init?: RequestInit & { json?: unknown }): Promise<T> => {
  const res = await fetch(`${base}${path}`, {
    ...init,
    method: init?.method ?? (init?.json !== undefined ? 'POST' : 'GET'),
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? body.detail ?? `${res.status}`)
  return body as T
}

export const api = <T,>(path: string, init?: RequestInit & { json?: unknown }) => request<T>('/api', path, init)
export const agents = <T,>(path: string, init?: RequestInit & { json?: unknown }) => request<T>('/agents', path, init)

export const useOnline = () => {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Feed en vivo por SSE (BE-FEED). */
export const useFeed = () => {
  const [events, setEvents] = useState<FeedEvent[]>([])
  useEffect(() => {
    const es = new EventSource('/api/feed/stream')
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as FeedEvent
      setEvents((prev) => (prev.some((p) => p.id === e.id) ? prev : [e, ...prev].slice(0, 100)))
    }
    return () => es.close()
  }, [])
  return events
}

export interface DemoStatus {
  mockOp: boolean
  mockSms: boolean
  rootGrant: boolean
  fxCopPerUsd: number
}
