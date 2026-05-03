const LEVELS = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
type Level = keyof typeof LEVELS;

// Default to 'info' in production, 'debug' otherwise
const configuredLevel: Level = (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const MIN_LEVEL = LEVELS[configuredLevel] ?? LEVELS.info;

export function createLogger(prefix: string) {
  const log = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (LEVELS[level] < MIN_LEVEL) return;
    const ts = new Date().toISOString();
    const obj = { ts, level, pid: process.pid, pidLabel: `${prefix}[${process.pid}]`, msg, ...meta };
    const output = `[${ts}] ${obj.pidLabel} [${level.toUpperCase()}] ${msg}`;
    if (meta) {
      process.stdout.write(JSON.stringify(obj) + '\n');
    } else if (level === 'error' || level === 'fatal') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
    fatal: (msg: string, meta?: Record<string, unknown>) => log('fatal', msg, meta),
  };
}
