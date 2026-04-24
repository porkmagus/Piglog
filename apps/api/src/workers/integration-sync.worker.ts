import { Worker } from 'bullmq';
import { integrationSyncQueue, redisConnection } from '../queues/index.js';
import { runIntegrationSyncJob } from '../modules/integrations/integrations.service.js';

new Worker(
  'integration-sync',
  async (job) => {
    await runIntegrationSyncJob(job.data.integrationId);
  },
  { connection: redisConnection }
);
