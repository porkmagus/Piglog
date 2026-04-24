import { db, integration, integrationSource } from '@piglog/db';
import { eq } from 'drizzle-orm';
import { getConnector } from './connectors/index.js';
import type { IntegrationConnector } from './connectors/types.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('stream-manager');

interface ActiveStream {
  connector: IntegrationConnector;
  stop: () => void;
}

const activeStreams = new Map<string, ActiveStream>();

export function startStream(integrationId: string): void {
  if (activeStreams.has(integrationId)) {
    stopStream(integrationId);
  }

  const run = async () => {
    const [int] = await db
      .select()
      .from(integration)
      .where(eq(integration.id, integrationId));

    if (!int || int.status === 'DISABLED') {
      activeStreams.delete(integrationId);
      return;
    }

    const connector = getConnector(int.provider);
    if (!connector?.stream) {
      activeStreams.delete(integrationId);
      return;
    }

    const cfg = (int.config && typeof int.config === 'object') ? (int.config as Record<string, unknown>) : {};
    const sources = await db
      .select()
      .from(integrationSource)
      .where(eq(integrationSource.integrationId, integrationId));

    if (sources.length === 0) {
      activeStreams.delete(integrationId);
      return;
    }

    const source = sources[0];
    const syncState = (cfg?.syncState as Record<string, unknown>) || {};
    const sourceState = (syncState[source.sourceId] as Record<string, unknown>) || {};

    const stop = connector.stream({
      workspaceId: int.workspaceId,
      integrationId: int.id,
      sourceId: source.sourceId,
      config: { ...cfg, profileId: source.externalId },
      secret: int.secret || '',
      state: sourceState,
      onEvent: async (nextState) => {
        if (!cfg.syncState) (cfg as Record<string, unknown>).syncState = {};
        (cfg.syncState as Record<string, Record<string, unknown>>)[source.sourceId] = nextState;
        await db
          .update(integration)
          .set({ config: cfg, updatedAt: new Date() })
          .where(eq(integration.id, integrationId));
        await db
          .update(integrationSource)
          .set({ status: 'CONNECTED' })
          .where(eq(integrationSource.id, source.id));
      },
      onEnd: () => {
        log.info(`Stream ended for integration ${integrationId}, restarting...`);
        startStream(integrationId);
      },
    });

    activeStreams.set(integrationId, { connector, stop });
  };

  run().catch((err) => {
    log.error(`Stream manager error: ${err instanceof Error ? err.message : String(err)}`);
    activeStreams.delete(integrationId);
  });
}

export function stopStream(integrationId: string): void {
  const stream = activeStreams.get(integrationId);
  if (stream) {
    stream.stop();
    activeStreams.delete(integrationId);
  }
}

export function stopAllStreams(): void {
  for (const id of activeStreams.keys()) {
    stopStream(id);
  }
}
