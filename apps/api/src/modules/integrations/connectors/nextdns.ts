import type { IntegrationConnector, DiscoveredIntegrationEntity, StreamParams } from './types.js';
import { ingestLogs } from '../../logs/logs.service.js';
import type { LogLevel } from '@piglog/db';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('nextdns-stream');

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

    log.info(`Starting NextDNS sync for profile ${profileId}`);

    const backfillHours = (params.config.backfillHours as number) || 24;
    const fromDate = new Date(Date.now() - backfillHours * 60 * 60 * 1000);
    const fromParam = fromDate.toISOString();

    const cursor = (params.state.cursor as string) || undefined;
    let profileCursor = cursor;
    let totalAccepted = 0;
    let firstPage = true;
    let pagesFetched = 0;

    do {
      if (pagesFetched >= MAX_PAGES_PER_SYNC) {
        log.info(`Reached MAX_PAGES_PER_SYNC (${MAX_PAGES_PER_SYNC}) for profile ${profileId}. Stopping sync for this cycle.`);
        break;
      }

      const pageCursor = firstPage ? undefined : profileCursor;
      const from = firstPage ? fromParam : undefined;
      firstPage = false;

      log.info(`Fetching page for ${profileId} (cursor: ${pageCursor || 'none'}, from: ${from || 'none'})`);
      const { logs, nextCursor } = await fetchNextDnsLogs(profileId, params.secret, pageCursor, from);
      pagesFetched++;

      if (logs.length === 0) {
        log.info(`No more logs for ${profileId}`);
        break;
      }

      log.info(`Received ${logs.length} logs for ${profileId}`);
      const mappedLogs = logs.map(mapNextDnsEventToPiglogLog);
      const result = await ingestLogs(params.workspaceId, params.sourceId, mappedLogs);
      totalAccepted += result.accepted;

      profileCursor = nextCursor || undefined;
    } while (profileCursor);

    log.info(`Completed NextDNS sync for profile ${profileId}: ${totalAccepted} logs accepted`);

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
                const mapped = mapNextDnsEventToPiglogLog(event);
                await ingestLogs(params.workspaceId, params.sourceId, [mapped]);
                params.onEvent({ ...params.state, streamId: lastStreamId });
              } catch (err) {
                log.error(`Failed to parse stream event: ${err instanceof Error ? err.message : String(err)}`);
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
      const delay = 5000;
      setTimeout(() => {
        if (!controller.signal.aborted) connect();
      }, delay);
    }

    connect();

    return () => {
      controller.abort();
      params.onEnd();
    };
  },
};
