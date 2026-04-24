import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const currentDir = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(currentDir, '../../../../.env.dev') });
}

await import('./alert.worker.js');
await import('./webhook.worker.js');

console.log('Workers started');

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down workers...`);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
