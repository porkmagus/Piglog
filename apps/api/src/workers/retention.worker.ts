/**
 * Retention cleanup worker.
 *
 * OSS TimescaleDB does not support `add_retention_policy()`.
 * This worker deletes log_entry rows older than RETENTION_DAYS using
 * TimescaleDB's `drop_chunks()` (which is available in all editions)
 * so the operation is chunk-aware and efficient.
 *
 * Runs once on startup and then every RETENTION_INTERVAL_HOURS.
 */
import { db } from '@piglog/db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';

const log = createLogger('retention');

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '14', 10);
const RETENTION_INTERVAL_HOURS = parseInt(process.env.RETENTION_INTERVAL_HOURS || '6', 10);

export async function runRetentionCleanup(): Promise<{ droppedChunks: number }> {
  const olderThan = `${RETENTION_DAYS} days`;

  try {
    // drop_chunks is safe on OSS TimescaleDB and much faster than a plain DELETE
    const result = await db.execute(
      sql`SELECT drop_chunks('log_entry', older_than => INTERVAL ${olderThan})`
    );
    log.debug(`Retention cleanup: drop_chunks completed (${RETENTION_DAYS}d)`);
    return { droppedChunks: result.length };
  } catch (err) {
    log.error(`Retention cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    return { droppedChunks: 0 };
  }
}

let intervalTimer: ReturnType<typeof setInterval> | null = null;

export function startRetentionWorker(): void {
  // Run once on startup (after a short delay to let the app finish booting)
  setTimeout(() => {
    runRetentionCleanup().then((r) => {
      log.debug(`Initial retention cleanup done (chunks dropped: ${r.droppedChunks})`);
    });
  }, 30_000);

  // Then run on a schedule
  const intervalMs = RETENTION_INTERVAL_HOURS * 60 * 60 * 1000;
  intervalTimer = setInterval(() => {
    runRetentionCleanup();
  }, intervalMs);

  log.info(`Retention worker started: keeping ${RETENTION_DAYS} days, checking every ${RETENTION_INTERVAL_HOURS}h`);
}

export function stopRetentionWorker(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
