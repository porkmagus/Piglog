import { useEffect, useRef, useState, useCallback } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  service: string;
  host: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  traceId: string | null;
  sourceId: string;
  workspaceId: string;
}

interface UseLiveLogsOptions {
  workspaceId: string | null;
  sourceId?: string;
  service?: string;
  level?: string;
  enabled?: boolean;
}

export function useLiveLogs({ workspaceId, sourceId, service, level, enabled = false }: UseLiveLogsOptions) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!enabled || !workspaceId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
      return;
    }

    const params = new URLSearchParams({ workspaceId });
    if (sourceId) params.set('sourceId', sourceId);
    if (service) params.set('service', service);
    if (level) params.set('level', level);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${API_URL}/logs/live?${params.toString()}`, {
      withCredentials: true,
    });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      if (!event.data || event.data.startsWith(':heartbeat')) return;
      try {
        const log: LogEntry = JSON.parse(event.data);
        if (!paused) {
          setLogs((prev) => {
            const next = [log, ...prev];
            return next.slice(0, 10000); // Keep max 10k live logs
          });
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, workspaceId, sourceId, service, level, paused]);

  return { logs, connected, paused, setPaused, clearLogs };
}
