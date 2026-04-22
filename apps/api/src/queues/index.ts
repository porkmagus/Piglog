import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const logProcessQueue = new Queue('log:process', { connection: redisConnection });
export const alertEvaluatorQueue = new Queue('alert:evaluate', { connection: redisConnection });
export const webhookNotifyQueue = new Queue('notify:webhook', { connection: redisConnection });
export const exportQueue = new Queue('export:generate', { connection: redisConnection });

export { redisConnection };
