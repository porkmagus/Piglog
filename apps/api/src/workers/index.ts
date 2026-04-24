import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';

const log = createLogger('workers');
const currentDir = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(currentDir, '../../../../.env.dev') });
}

const alertWorker = (await import('./alert.worker.js')).alertWorker;
const webhookWorker = (await import('./webhook.worker.js')).webhookWorker;
const integrationSyncWorker = (await import('./integration-sync.worker.js')).integrationSyncWorker;

log.info('Workers started');

const shutdown = async (signal: string) => {
  log.info(`Received ${signal}, shutting down workers...`);
  await Promise.allSettled([
    alertWorker?.close(),
    webhookWorker?.close(),
    integrationSyncWorker?.close(),
  ]);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
