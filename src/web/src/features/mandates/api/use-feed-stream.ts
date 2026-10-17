import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { env } from '@/config/env';
import { currentRootMandateId } from '@/lib/auth';
import { currentToken } from '@/lib/session';
import { type FeedEvent } from '@/types/api';

// GET /feed/stream (SSE) — la libreta en vivo. Cada mensaje es un FeedEvent
// en JSON. Los eventos que mueven dinero o cambian ramas refrescan el árbol.

const MAX_EVENTOS = 50;

export type FeedStatus = 'connecting' | 'open' | 'closed' | 'unsupported';

export const useFeedStream = ({
  enabled = true,
}: { enabled?: boolean } = {}) => {
  const queryClient = useQueryClient();
  const [events, setEvents] = React.useState<FeedEvent[]>([]);
  const [status, setStatus] = React.useState<FeedStatus>(
    typeof EventSource === 'undefined' ? 'unsupported' : 'connecting',
  );

  React.useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    // Cada titular ve solo los eventos de su árbol.
    // EventSource no admite cabeceras: el token va en la query.
    const params = new URLSearchParams();
    const root = currentRootMandateId();
    if (root) params.set('root', root);
    const token = currentToken();
    if (token) params.set('token', token);
    const source = new EventSource(`${env.API_URL}/feed/stream?${params}`);
    source.onopen = () => setStatus('open');
    source.onerror = () =>
      setStatus(
        source.readyState === EventSource.CLOSED ? 'closed' : 'connecting',
      );
    source.onmessage = (message: MessageEvent<string>) => {
      let event: FeedEvent;
      try {
        event = JSON.parse(message.data) as FeedEvent;
      } catch {
        return;
      }
      setEvents((prev) =>
        prev.some((e) => e.id === event.id)
          ? prev
          : [event, ...prev]
              .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
              .slice(0, MAX_EVENTOS),
      );
      if (event.kind !== 'denied')
        queryClient.invalidateQueries({ queryKey: ['mandates'] });
    };

    return () => source.close();
  }, [enabled, queryClient]);

  return { events, status };
};
