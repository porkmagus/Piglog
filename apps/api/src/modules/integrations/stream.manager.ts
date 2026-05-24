import { db, integration, integrationSource } from '@piglog/db';
import { eq } from 'drizzle-orm';
import { getConnector } from './connectors/index.js';
import type { IntegrationConnector } from './connectors/types.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('stream-manager');

const STREAM_ID_BATCH_INTERVAL_MS = 10_000;
const STREAM_ID_BATCH_COUNT = 50;

interface ActiveStream {
  connector: IntegrationConnector;
  stop: () => void;
}

interface StreamState {
  pendingState: Record<string, unknown> | null;
  eventCount: number;
  batchTimer: ReturnType<typeof setTimeout> | null;
}

const activeStreams = new Map<string, { stream: ActiveStream; state: StreamState }>();

function flushStreamState(integrationId: string): Promise<void> {
  const entry = activeStreams.get(integrationId);
  if (!entry) return Promise.resolve();
  const { state } = entry;
  if (!state.pendingState) return Promise.resolve();

  const pendingState = state.pendingState;
  state.pendingState = null;
  state.eventCount = 0;
  if (state.batchTimer) {
    clearTimeout(state.batchTimer);
    state.batchTimer = null;
  }

  const flush = async () => {
    const [int] = await db
      .select()
      .from(integration)
      .where(eq(integration.id, integrationId));
    if (!int) return;

    const cfg = (int.config && typeof int.config === 'object') ? (int.config as Record<string, unknown>) : {};
    if (!cfg.syncState) (cfg as Record<string, unknown>).syncState = {};
    const sources = await db
      .select()
      .from(integrationSource)
      .where(eq(integrationSource.integrationId, integrationId));
    if (sources.length === 0) return;

    (cfg.syncState as Record<string, Record<string, unknown>>)[sources[0].sourceId] = pendingState;
    await db
      .update(integration)
      .set({ config: cfg, updatedAt: new Date() })
      .where(eq(integration.id, integrationId));
  };

  return flush().catch((err) => {
    log.error(`Failed to flush stream state: ${err instanceof Error ? err.message : String(err)}`);
  });
}

export function startStream(integrationId: string): void {
  if (activeStreams.has(integrationId)) {
    stopStream(integrationId);
  }

  const streamState: StreamState = {
    pendingState: null,
    eventCount: 0,
    batchTimer: null,
  };

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
      onEvent: (nextState) => {
        streamState.pendingState = nextState;
        streamState.eventCount++;

        if (streamState.eventCount >= STREAM_ID_BATCH_COUNT) {
          flushStreamState(integrationId).catch((err) => {
            log.warn(`Batch flush for integration ${integrationId}: ${err instanceof Error ? err.message : String(err)}`);
          });
        } else if (!streamState.batchTimer) {
          streamState.batchTimer = setTimeout(() => {
            flushStreamState(integrationId).catch((err) => {
              log.warn(`Timer flush for integration ${integrationId}: ${err instanceof Error ? err.message : String(err)}`);
            });
          }, STREAM_ID_BATCH_INTERVAL_MS);
        }
      },
      onEnd: () => {
        log.debug(`Stream ended for integration ${integrationId}`);
      },
    });

    activeStreams.set(integrationId, { stream: { connector, stop }, state: streamState });
  };

  run().catch((err) => {
    log.error(`Stream manager error: ${err instanceof Error ? err.message : String(err)}`);
    activeStreams.delete(integrationId);
  });
}

export function stopStream(integrationId: string): void {
  const entry = activeStreams.get(integrationId);
  if (entry) {
    entry.stream.stop();
    activeStreams.delete(integrationId);
    flushStreamState(integrationId).catch((err) => {
      log.warn(`Stop-stream flush for integration ${integrationId}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}

export function stopAllStreams(): void {
  for (const id of activeStreams.keys()) {
    stopStream(id);
  }
}
