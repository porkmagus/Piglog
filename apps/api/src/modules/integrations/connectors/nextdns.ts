import type { IntegrationConnector, DiscoveredIntegrationEntity } from './types.js';
import { ingestLogs } from '../../logs/logs.service.js';
import type { LogLevel } from '@piglog/db';

interface NextDnsProfile {
  id: string;
  name: string;
}

interface NextDnsLogEvent {
  id: string;
  timestamp: string;
  status: string;
  query: string;
  deviceName?: string;
  clientIp?: string;
  [key: string]: unknown;
}

const MAX_SYNC_PAGES = 50;
const SYNC_BATCH_SIZE = 500;

export function mapNextDnsEventToPiglogLog(event: NextDnsLogEvent) {
  const level: LogLevel = event.status === 'blocked' ? 'WARN' : event.status === 'error' ? 'ERROR' : 'INFO';

  return {
    timestamp: event.timestamp,
    level,
    service: 'nextdns',
    host: event.deviceName || event.clientIp || 'nextdns',
    message: `${event.status} dns query for ${event.query}`,
    metadata: event,
  };
}

async function fetchNextDnsLogs(profileId: string, secret: string, since?: string): Promise<NextDnsLogEvent[]> {
  const url = since
    ? `https://api.nextdns.io/profile/${profileId}/log?since=${since}`
    : `https://api.nextdns.io/profile/${profileId}/log`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${secret}` },
  });

  if (!res.ok) {
    throw new Error(`NextDNS sync failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return Array.isArray(data) ? data : [];
}

export const nextDnsConnector: IntegrationConnector = {
  provider: 'nextdns',

  async testConnection(_config: Record<string, unknown>, secret: string) {
    const res = await fetch('https://api.nextdns.io/profile', {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    if (!res.ok) {
      throw new Error(`NextDNS connection test failed: ${res.status} ${res.statusText}`);
    }
  },

  async discoverEntities(_config: Record<string, unknown>, secret: string): Promise<DiscoveredIntegrationEntity[]> {
    const res = await fetch('https://api.nextdns.io/profile', {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    if (!res.ok) {
      throw new Error(`NextDNS discovery failed: ${res.status} ${res.statusText}`);
    }
    const data: unknown = await res.json();
    const profiles: NextDnsProfile[] = Array.isArray(data) ? data : [];
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

    let cursor = (params.state.cursor as string) || undefined;
    let totalAccepted = 0;
    let pages = 0;

    do {
      const logs = await fetchNextDnsLogs(profileId, params.secret, cursor);

      if (logs.length === 0) break;

      const batch = logs.slice(0, SYNC_BATCH_SIZE);
      const mappedLogs = batch.map(mapNextDnsEventToPiglogLog);
      const result = await ingestLogs(params.workspaceId, params.sourceId, mappedLogs);
      totalAccepted += result.accepted;

      cursor = logs[logs.length - 1].id;
      pages++;
    } while (pages < MAX_SYNC_PAGES);

    return {
      nextState: {
        ...params.state,
        cursor,
      },
      accepted: totalAccepted,
    };
  },
};
