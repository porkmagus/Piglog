import { Worker } from 'bullmq';
import { redisConnection } from '../queues/index.js';
import { runIntegrationSyncJob } from '../modules/integrations/integrations.service.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('integration-sync');

export const integrationSyncWorker = new Worker(
  'integration-sync',
  async (job) => {
    log.debug(`Sync job started for ${job.data.integrationId} (attempt ${job.attemptsMade})`);
    try {
      await runIntegrationSyncJob(job.data.integrationId);
      log.debug(`Sync job completed for ${job.data.integrationId}`);
    } catch (err) {
      log.error(`Sync job failed for ${job.data.integrationId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  },
  {
    connection: redisConnection,
    // Only one sync at a time globally; individual integration guard is in the service
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  }
);

integrationSyncWorker.on('error', (err) => {
  log.error(`Integration sync worker error: ${err.message}`);
});
