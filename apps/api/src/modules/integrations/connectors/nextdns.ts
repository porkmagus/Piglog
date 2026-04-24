import type { IntegrationConnector, DiscoveredIntegrationEntity } from './types.js';

export function mapNextDnsEventToPiglogLog(event: {
  timestamp: string;
  status: string;
  query: string;
  deviceName?: string;
  clientIp?: string;
}) {
  const level = event.status === 'blocked' ? 'WARN' : event.status === 'error' ? 'ERROR' : 'INFO';

  return {
    timestamp: event.timestamp,
    level,
    service: 'nextdns',
    host: event.deviceName || event.clientIp || 'nextdns',
    message: `${event.status} dns query for ${event.query}`,
    metadata: event,
  };
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
    const data: any = await res.json();
    const profiles = Array.isArray(data) ? data : (data.results || []);
    return profiles.map((p: { id: string; name: string }) => ({
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

    const since = (params.state.cursor as string) || undefined;
    const res = await fetch(
      `https://api.nextdns.io/profile/${profileId}/log${since ? `?since=${since}` : ''}`,
      {
        headers: { 'Authorization': `Bearer ${params.secret}` },
      }
    );

    if (!res.ok) {
      throw new Error(`NextDNS sync failed: ${res.status} ${res.statusText}`);
    }

    const rawLogs = await res.json();
    const logs: any[] = Array.isArray(rawLogs) ? rawLogs : [];
    const accepted = Array.isArray(logs) ? logs.length : 0;

    return {
      nextState: {
        ...params.state,
        cursor: logs.length > 0 ? (logs[logs.length - 1] as any)?.streamId : params.state.cursor,
      },
      accepted,
    };
  },
};
