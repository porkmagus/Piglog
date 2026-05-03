import type { IntegrationConnector, DiscoveredIntegrationEntity, StreamParams } from './types.js';
import { ingestLogs } from '../../logs/logs.service.js';
import type { LogLevel } from '@piglog/db';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('nextdns');

interface NextDnsProfile {
  id: string;
  name: string;
}

interface NextDnsLogEvent {
  id?: string;
  timestamp: string;
  domain: string;
  status: string;
  clientIp?: string;
  client?: string;
  device?: { name: string };
  [key: string]: unknown;
}

const SYNC_BATCH_SIZE = 500;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_PAGES_PER_SYNC = 20;

/** Stream batching: flush buffered events every N ms or when buffer reaches this count. */
const STREAM_MAX_EVENT_BUFFER = 100;
const STREAM_FLUSH_INTERVAL_MS = 5_000;

/** Reconnect: exponential backoff with jitter, capped at RECONNECT_MAX_MS, give up after RECONNECT_MAX_ATTEMPTS. */
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const RECONNECT_MAX_ATTEMPTS = 20;

export function mapNextDnsEventToPiglogLog(event: NextDnsLogEvent) {
  const level: LogLevel = event.status === 'blocked' ? 'WARN' : event.status === 'error' ? 'ERROR' : 'INFO';
  const deviceName = event.device?.name || event.client;

  return {
    timestamp: event.timestamp,
    level,
    service: 'nextdns',
    host: deviceName || event.clientIp || 'nextdns',
    message: `${event.status} dns query for ${event.domain}`,
    metadata: event,
  };
}

async function fetchNextDnsLogs(profileId: string, apiKey: string, cursor?: string, from?: string): Promise<{ logs: NextDnsLogEvent[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: String(SYNC_BATCH_SIZE) });
  if (cursor) params.set('cursor', cursor);
  if (from) params.set('from', from);

  const res = await fetch(`https://api.nextdns.io/profiles/${profileId}/logs?${params}`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`NextDNS sync failed: ${res.status} ${res.statusText}`);
  }

  const result = (await res.json()) as { data?: NextDnsLogEvent[]; meta?: { pagination?: { cursor?: string | null } } };
  const logs = result.data || [];
  const nextCursor = result.meta?.pagination?.cursor ?? null;
  return { logs, nextCursor };
}

export const nextDnsConnector: IntegrationConnector = {
  provider: 'nextdns',

  async testConnection(_config: Record<string, unknown>, secret: string) {
    const res = await fetch('https://api.nextdns.io/profiles', {
      headers: { 'X-Api-Key': secret },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`NextDNS connection test failed: ${res.status} ${res.statusText}`);
    }
  },

  async discoverEntities(_config: Record<string, unknown>, secret: string): Promise<DiscoveredIntegrationEntity[]> {
    const res = await fetch('https://api.nextdns.io/profiles', {
      headers: { 'X-Api-Key': secret },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`NextDNS discovery failed: ${res.status} ${res.statusText}`);
    }
    const result = (await res.json()) as { data?: NextDnsProfile[] };
    const profiles: NextDnsProfile[] = result.data || [];
    return profiles.map((p) => ({
      id: p.id,
      name: p.name || p.id,
    }));
  },

  async sync(params: {
    workspaceId: string;
    integrationId: string;
    sourceId: string;
    config: Record<string, unknown>;
    secret: string;
    state: Record<string, unknown>;
  }): Promise<{ nextState: Record<string, unknown>; accepted: number }> {
    const profileId = params.config.profileId as string;
    if (!profileId) {
      return { nextState: params.state, accepted: 0 };
    }

    const cursor = (params.state.cursor as string) || undefined;

    // Only use a time-window `from` param on the very first sync (no saved cursor).
    // On recurring syncs, always follow the cursor to avoid re-ingesting already-seen logs.
    let fromParam: string | undefined;
    if (!cursor) {
      const backfillHours = (params.config.backfillHours as number) || 24;
      fromParam = new Date(Date.now() - backfillHours * 60 * 60 * 1000).toISOString();
      log.debug(`First sync for ${profileId}, backfill from ${fromParam}`);
    }

    let profileCursor = cursor;
    let totalAccepted = 0;
    let firstPage = true;
    let pagesFetched = 0;

    do {
      if (pagesFetched >= MAX_PAGES_PER_SYNC) {
        log.debug(`Reached MAX_PAGES_PER_SYNC for ${profileId}, will resume next cycle`);
        break;
      }

      const pageCursor = firstPage ? cursor : profileCursor;
      const from = (firstPage && !cursor) ? fromParam : undefined;
      firstPage = false;

      const { logs, nextCursor } = await fetchNextDnsLogs(profileId, params.secret, pageCursor, from);
      pagesFetched++;

      if (logs.length === 0) break;

      const mappedLogs = logs.map(mapNextDnsEventToPiglogLog);
      const result = await ingestLogs(params.workspaceId, params.sourceId, mappedLogs);
      totalAccepted += result.accepted;

      // If ingestLogs rejected the batch (daily limit hit), stop immediately
      // WITHOUT advancing the cursor past this page — so it gets retried next cycle.
      if (result.accepted === 0) {
        log.warn(`Daily limit reached for ${profileId}, stopping sync early (will retry this page next cycle)`);
        break;
      }

      // Only advance cursor after a successful ingest
      profileCursor = nextCursor || undefined;
    } while (profileCursor);

    log.debug(`Synced ${profileId}: ${totalAccepted} logs in ${pagesFetched} pages`);

    return {
      nextState: {
        ...params.state,
        cursor: profileCursor || null,
      },
      accepted: totalAccepted,
    };
  },

  stream(params: StreamParams): () => void {
    const profileId = params.config.profileId as string;
    if (!profileId) {
      params.onEnd();
      return () => {};
    }

    const controller = new AbortController();
    let lastStreamId: string | null = (params.state.streamId as string) || null;
    let reconnectAttempts = 0;

    // Buffer stream events and flush in batches to avoid per-event DB inserts.
    const eventBuffer: ReturnType<typeof mapNextDnsEventToPiglogLog>[] = [];
    const STREAM_HARD_CAP = STREAM_MAX_EVENT_BUFFER * 10; // Drop events if flush keeps failing
    let pendingState: Record<string, unknown> | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let flushing = false; // Guard against concurrent flushes
    let streamDailyHits = 0;
    const STREAM_MAX_DAILY_REJECTIONS = 3;

    async function flushBuffer() {
      if (flushing || eventBuffer.length === 0) return;
      flushing = true;
      try {
        const batch = eventBuffer.splice(0, eventBuffer.length);
        try {
          const result = await ingestLogs(params.workspaceId, params.sourceId, batch);
          // If the daily limit is hit, count consecutive rejections
          if (result.accepted === 0) {
            streamDailyHits++;
            if (streamDailyHits >= STREAM_MAX_DAILY_REJECTIONS) {
              log.warn(`Stream for ${profileId}: daily limit hit ${streamDailyHits} times, stopping stream until next restart`);
              controller.abort();
              if (flushTimer) clearInterval(flushTimer);
              flushTimer = null;
              params.onEnd();
              return;
            }
          } else {
            streamDailyHits = 0;
          }
        } catch (err) {
          log.error(`Stream batch ingest failed: ${err instanceof Error ? err.message : String(err)}`);
          // Put events back at the front for retry — but only if under hard cap
          if (eventBuffer.length + batch.length <= STREAM_HARD_CAP) {
            eventBuffer.unshift(...batch);
          } else {
            log.warn(`Stream buffer overflow for ${profileId}, dropping ${batch.length} events`);
          }
        }
        if (pendingState) {
          params.onEvent(pendingState);
          pendingState = null;
        }
      } finally {
        flushing = false;
      }
      if (flushTimer && eventBuffer.length === 0) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    }

    function scheduleFlush() {
      if (!flushTimer) {
        flushTimer = setInterval(() => { flushBuffer(); }, STREAM_FLUSH_INTERVAL_MS);
      }
      if (eventBuffer.length >= STREAM_MAX_EVENT_BUFFER) {
        flushBuffer();
      }
    }

    async function connect() {
      const streamUrl = new URL(`https://api.nextdns.io/profiles/${profileId}/logs/stream`);
      if (lastStreamId) {
        streamUrl.searchParams.set('id', lastStreamId);
      }

      try {
        const res = await fetch(streamUrl.toString(), {
          headers: { 'X-Api-Key': params.secret },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          log.error(`Stream connection failed: ${res.status} ${res.statusText}`);
          reconnect();
          return;
        }

        reconnectAttempts = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('id:')) {
              lastStreamId = line.slice(3).trim();
            } else if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              try {
                const event = JSON.parse(data) as NextDnsLogEvent;
                eventBuffer.push(mapNextDnsEventToPiglogLog(event));
                pendingState = { ...params.state, streamId: lastStreamId };
                scheduleFlush();
              } catch (err) {
                log.debug(`Failed to parse stream event: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        log.error(`Stream error: ${err instanceof Error ? err.message : String(err)}`);
        reconnect();
      }
    }

    function reconnect() {
      reconnectAttempts++;
      if (reconnectAttempts > RECONNECT_MAX_ATTEMPTS) {
        log.error(`Max reconnect attempts (${RECONNECT_MAX_ATTEMPTS}) reached for ${profileId}, giving up`);
        controller.abort();
        flushBuffer();
        params.onEnd();
        return;
      }
      const base = Math.min(RECONNECT_BASE_MS * 2 ** (reconnectAttempts - 1), RECONNECT_MAX_MS);
      const jitter = Math.random() * base * 0.2;
      const delay = Math.round(base + jitter);
      log.debug(`Reconnect ${reconnectAttempts}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms`);
      setTimeout(() => {
        if (!controller.signal.aborted) connect();
      }, delay);
    }

    connect();

    return () => {
      controller.abort();
      if (flushTimer) clearInterval(flushTimer);
      flushBuffer();
      params.onEnd();
    };
  },
};
