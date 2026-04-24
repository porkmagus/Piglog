import { Worker } from 'bullmq';
import { integrationSyncQueue, redisConnection } from '../queues/index.js';
import { runIntegrationSyncJob } from '../modules/integrations/integrations.service.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('integration-sync');

export const integrationSyncWorker = new Worker(
  'integration-sync',
  async (job) => {
    try {
      await runIntegrationSyncJob(job.data.integrationId);
    } catch (err) {
      log.error(`Sync job failed for ${job.data.integrationId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  },
  { connection: redisConnection }
);
