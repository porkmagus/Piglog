import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  // Log but don't crash — Redis is needed for queues/live-tail, not core ingestion
  console.error(`[Redis] Connection error: ${err.message}`);
});

redisConnection.on('connect', () => {
  const safeUrl = redisUrl.includes('://') ? redisUrl.split('@')[0] + '***@...' : redisUrl;
  console.log('[Redis] Connected to', safeUrl);
});

export const logProcessQueue = new Queue('log-process', { connection: redisConnection });
export const alertEvaluatorQueue = new Queue('alert-evaluate', { connection: redisConnection });
export const webhookNotifyQueue = new Queue('notify-webhook', { connection: redisConnection });
export const exportQueue = new Queue('export-generate', { connection: redisConnection });
export const integrationSyncQueue = new Queue('integration-sync', { connection: redisConnection });

export { redisConnection };
