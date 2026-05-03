import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from '../lib/logger.js';

const log = createLogger('queues');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  log.error(`Redis connection error: ${err.message}`);
});

redisConnection.on('connect', () => {
  const safeUrl = redisUrl.includes('://') ? redisUrl.split('@')[0] + '***@...' : redisUrl;
  log.debug(`Connected to ${safeUrl}`);
});

// Default options to prevent unbounded completed/failed job accumulation
const defaultJobOpts = {
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  },
};

export const alertEvaluatorQueue = new Queue('alert-evaluate', {
  connection: redisConnection,
  ...defaultJobOpts,
});
export const webhookNotifyQueue = new Queue('notify-webhook', {
  connection: redisConnection,
  ...defaultJobOpts,
});
export const integrationSyncQueue = new Queue('integration-sync', {
  connection: redisConnection,
  ...defaultJobOpts,
});

export { redisConnection };
