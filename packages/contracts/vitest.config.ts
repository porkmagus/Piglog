import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Load env from root .env.dev
const envPath = path.resolve(__dirname, '../../.env.dev');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      process.env[key] = rest.join('=');
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@piglog/api': path.resolve(__dirname, '../../apps/api/src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
