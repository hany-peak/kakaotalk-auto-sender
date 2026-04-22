import { useEffect, useRef } from 'react';
import type { SSEEvent } from '../types';

const API = `${window.location.origin}/api`;

export function useSSE(onEvent: (event: SSEEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(`${API}/events`);

    source.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        /* ignore parse errors */
      }
    };

    return () => {
      source.close();
    };
  }, []);
}
