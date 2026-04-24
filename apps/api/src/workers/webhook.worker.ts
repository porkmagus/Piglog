import { Worker } from 'bullmq';
import { redisConnection } from '../queues/index.js';

const WEBHOOK_TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10);
const WEBHOOK_MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10);

interface WebhookJobData {
  url: string;
  payload: Record<string, unknown>;
}

const webhookWorker = new Worker<WebhookJobData>(
  'notify-webhook',
  async (job) => {
    const { url, payload } = job.data;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Piglog-Webhook/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseText.slice(0, 200)}`
        );
      }

      console.log(`[webhook] Delivered to ${url} (HTTP ${response.status})`);
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[webhook] Failed to deliver to ${url}: ${message}`);
      throw err; // Let BullMQ handle retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

webhookWorker.on('completed', (job) => {
  console.log(`[webhook] Job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
  const attempts = job?.attemptsMade ?? 0;
  const maxAttempts = (job?.opts.attempts ?? WEBHOOK_MAX_RETRIES) + 1;
  console.error(
    `[webhook] Job ${job?.id} failed (${attempts}/${maxAttempts}): ${err.message}`
  );
});

webhookWorker.on('error', (err) => {
  console.error('[webhook] Worker error:', err);
});

export { webhookWorker };
