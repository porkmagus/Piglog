import { Worker } from 'bullmq';
import { integrationSyncQueue, redisConnection } from '../queues/index.js';
import { runIntegrationSyncJob } from '../modules/integrations/integrations.service.js';

export const integrationSyncWorker = new Worker(
  'integration-sync',
  async (job) => {
    try {
      await runIntegrationSyncJob(job.data.integrationId);
    } catch (err) {
      console.error(`Integration sync job failed for ${job.data.integrationId}:`, err);
      throw err;
    }
  },
  { connection: redisConnection }
);
