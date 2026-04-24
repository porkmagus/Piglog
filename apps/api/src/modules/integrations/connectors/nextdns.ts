import type { IntegrationConnector, DiscoveredIntegrationEntity } from './types.js';
import { ingestLogs } from '../../logs/logs.service.js';
import type { LogLevel } from '@piglog/db';

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

    const backfillHours = (params.config.backfillHours as number) || 24;
    const fromDate = new Date(Date.now() - backfillHours * 60 * 60 * 1000);
    const fromParam = fromDate.toISOString();

    const cursor = (params.state.cursor as string) || undefined;
    let profileCursor = cursor;
    let totalAccepted = 0;
    let firstPage = true;

    do {
      const pageCursor = firstPage ? undefined : profileCursor;
      const from = firstPage ? fromParam : undefined;
      firstPage = false;

      const { logs, nextCursor } = await fetchNextDnsLogs(profileId, params.secret, pageCursor, from);

      if (logs.length === 0) break;

      const mappedLogs = logs.map(mapNextDnsEventToPiglogLog);
      const result = await ingestLogs(params.workspaceId, params.sourceId, mappedLogs);
      totalAccepted += result.accepted;

      profileCursor = nextCursor || undefined;
    } while (profileCursor);

    return {
      nextState: {
        ...params.state,
        cursor: profileCursor || null,
      },
      accepted: totalAccepted,
    };
  },
};
