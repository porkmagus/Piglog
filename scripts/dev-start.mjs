#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Load .env.dev for this script and child processes
config({ path: resolve(rootDir, '.env.dev') });

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: rootDir,
      env: { ...process.env, ...options.env },
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => { stdout += data; });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => { stderr += data; });
    }

    child.on('close', (code) => {
      if (code !== 0 && !options.ignoreError) {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      } else {
        resolve({ code, stdout, stderr });
      }
    });
  });
}

async function isContainerHealthy(name) {
  try {
    const { stdout } = await run('docker', ['inspect', '--format={{.State.Health.Status}}', name], { silent: true, ignoreError: true });
    return stdout.trim() === 'healthy';
  } catch {
    return false;
  }
}

async function main() {
  log('🐷  Piglog Dev Environment', BLUE);
  log('');

  // Check Docker
  log('→ Checking Docker...', YELLOW);
  try {
    await run('docker', ['version'], { silent: true });
  } catch {
    log('❌ Docker is not running. Start Docker Desktop or dockerd first.', RED);
    process.exit(1);
  }
  log('✓ Docker is running', GREEN);

  // Start infrastructure
  log('→ Starting infrastructure (TimescaleDB + Redis)...', YELLOW);
  await run('docker', ['compose', '-f', 'ops/docker/compose.dev.yml', '--env-file', '.env.dev', 'up', '-d']);
  log('✓ Infrastructure containers started', GREEN);

  // Wait for DB
  log('→ Waiting for TimescaleDB to be healthy...', YELLOW);
  let attempts = 0;
  while (!(await isContainerHealthy('piglog-timescale-dev'))) {
    attempts++;
    if (attempts > 30) {
      log('❌ TimescaleDB failed to become healthy after 30s', RED);
      process.exit(1);
    }
    await setTimeout(1000);
  }
  log('✓ TimescaleDB is healthy', GREEN);

  // Run migrations
  log('→ Running database migrations...', YELLOW);
  try {
    await run('npx', ['tsx', 'packages/db/src/migrate.ts'], { silent: true });
    log('✓ Migrations complete', GREEN);
  } catch (err) {
    log(`⚠️  Migration warning: ${err.message}`, YELLOW);
  }

  log('');
  log('→ Starting application servers...', YELLOW);
  log('');

  // Use concurrently to run all dev servers with prefixed output
  const concurrently = spawn('npx', [
    'concurrently',
    '--names', 'API,WORKER,WEB',
    '--prefix-colors', 'cyan,magenta,green',
    '--kill-others',
    '--restart-tries', '1',
    'npm:dev:api',
    'npm:dev:worker',
    'npm:dev:web',
  ], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  concurrently.on('close', (code) => {
    log('');
    log('👋  Dev servers stopped.', BLUE);
    log('   Docker infra is still running. Run `npm run dev:stop` to shut it down.', YELLOW);
    process.exit(code ?? 0);
  });

  // Forward Ctrl+C / SIGTERM to concurrently so it exits cleanly
  process.on('SIGINT', () => concurrently.kill('SIGINT'));
  process.on('SIGTERM', () => concurrently.kill('SIGTERM'));
}

main().catch((err) => {
  log(`❌ ${err.message}`, RED);
  process.exit(1);
});
