#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: rootDir,
      shell: options.shell ?? false,
    });

    let stdout = '';
    if (child.stdout) child.stdout.on('data', (d) => { stdout += d; });
    if (child.stderr) child.stderr.on('data', () => {});

    child.on('close', () => resolve(stdout));
  });
}

async function killByPattern(pattern) {
  try {
    const stdout = await run('pgrep', ['-f', pattern], { silent: true });
    const pids = stdout.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        // already dead
      }
    }
    return pids.length;
  } catch {
    return 0;
  }
}

async function killByPort(port) {
  try {
    await run('fuser', ['-k', `${port}/tcp`], { silent: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  log('🛑  Piglog Dev Shutdown', BLUE);
  log('');

  // Kill the concurrently parent first so it doesn't restart children
  log('→ Stopping dev server supervisor...', YELLOW);
  const concurrentlyKilled = await killByPattern('concurrently.*API,WORKER,WEB');
  if (concurrentlyKilled > 0) {
    log(`✓ Stopped concurrently supervisor`, GREEN);
  }

  // Give children a moment to receive SIGTERM
  await setTimeout(500);

  // Kill any lingering processes by port
  log('→ Cleaning up processes on dev ports...', YELLOW);
  const ports = [3001, 5173, 5174, 5140, 5141];
  for (const port of ports) {
    await killByPort(port);
  }

  // Also kill any remaining tsx/react-router processes
  await killByPattern('tsx watch.*piglog');
  await killByPattern('react-router dev');

  log('✓ Dev servers stopped', GREEN);

  // Stop Docker infrastructure
  log('→ Stopping Docker infrastructure...', YELLOW);
  try {
    await run('docker', ['compose', '-f', 'ops/docker/compose.dev.yml', '--env-file', '.env.dev', 'down']);
    log('✓ Infrastructure stopped', GREEN);
  } catch {
    log('⚠️  Failed to stop Docker infrastructure (may already be stopped)', YELLOW);
  }

  log('');
  log('👋  Dev environment cleaned up. See you next time!', BLUE);
}

main().catch((err) => {
  log(`❌ ${err.message}`, RED);
  process.exit(1);
});
