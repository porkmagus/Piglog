import { eq, and, gte, lte, desc, sql, ilike, type SQL } from 'drizzle-orm';
import { db, logEntry, logSource, logLevelEnum } from '@piglog/db';
import type { LogLevel } from '@piglog/db';
import { parseQuery, type QueryClause } from '@piglog/contracts';
import { redisConnection } from '../../queues/index.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('logs');

/**
 * Per-workspace daily ingest cap. Prevents runaway ingestion from consuming all disk.
 * Set via WORKSPACE_DAILY_LOG_LIMIT env var (default: 2M entries/day).
 *
 * Uses two layers:
 *  1. Redis (persistent across restarts) — authoritative counter
 *  2. In-memory Map (fast path, avoids Redis round-trip for every batch)
 *
 * The in-memory map is periodically pruned to prevent unbounded growth.
 */
const DEFAULT_DAILY_LOG_LIMIT = 2_000_000;
const WORKSPACE_DAILY_LOG_LIMIT = parseInt(process.env.WORKSPACE_DAILY_LOG_LIMIT || String(DEFAULT_DAILY_LOG_LIMIT), 10);
const DAILY_LIMIT_REDIS_PREFIX = 'piglog:daily:';

// In-memory fast-path counter (authoritative source is Redis)
const dailyCounts = new Map<string, { date: string; count: number }>();

// Throttle daily-limit warnings: at most one per workspace per minute
const lastLimitWarn = new Map<string, number>();
const LIMIT_WARN_THROTTLE_MS = 60_000;

// Prune stale workspace entries every 10 minutes to prevent memory leak
const pruneTimer = setInterval(() => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, entry] of dailyCounts) {
    if (entry.date !== today) {
      dailyCounts.delete(key);
    }
  }
  // Prune warn throttle map (stale after 2 minutes)
  const now = Date.now();
  for (const [key, ts] of lastLimitWarn) {
    if (now - ts > 120_000) lastLimitWarn.delete(key);
  }
}, 10 * 60 * 1000);
pruneTimer.unref();

/**
 * Check and increment the daily log limit for a workspace.
 *
 * Uses a two-phase approach:
 *  1. Fast in-memory check (optimistic)
 *  2. Redis INCR as the authoritative, persistent counter
 *
 * If the Redis count exceeds the limit, the in-memory entry is corrected.
 * Returns `true` if the batch is allowed, `false` if the limit is exceeded.
 */
async function checkDailyLimit(workspaceId: string, batchSize: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const redisKey = `${DAILY_LIMIT_REDIS_PREFIX}${workspaceId}:${today}`;

  // Fast path: check in-memory first
  let entry = dailyCounts.get(workspaceId);
  if (!entry || entry.date !== today) {
    entry = { date: today, count: 0 };
    dailyCounts.set(workspaceId, entry);
  }

  // Optimistic check — skip Redis round-trip if we're clearly under limit
  if (entry.count + batchSize > WORKSPACE_DAILY_LOG_LIMIT) {
    // Double-check against Redis (authoritative source)
    try {
      const redisCount = await redisConnection.get(redisKey);
      const authoritativeCount = redisCount ? parseInt(redisCount, 10) : 0;
      entry.count = authoritativeCount;
      if (authoritativeCount + batchSize > WORKSPACE_DAILY_LOG_LIMIT) {
        // Throttled warn — at most once per workspace per minute
        const last = lastLimitWarn.get(workspaceId) || 0;
        if (Date.now() - last > LIMIT_WARN_THROTTLE_MS) {
          lastLimitWarn.set(workspaceId, Date.now());
          log.warn(`Daily limit (${WORKSPACE_DAILY_LOG_LIMIT.toLocaleString()}) reached for workspace ${workspaceId}`);
        }
        return false;
      }
    } catch {
      // Redis unavailable — deny to be safe
      return false;
    }
  }

  // Increment Redis counter (authoritative, persists across restarts)
  try {
    const newCount = await redisConnection.incrby(redisKey, batchSize);
    // Set expiry on first write of the day (86400s = 24h)
    if (newCount === batchSize) {
      await redisConnection.expire(redisKey, 86400);
    }
    entry.count = newCount;
  } catch {
    // Redis unavailable — still update in-memory as degraded fallback
    entry.count += batchSize;
  }

  return true;
}

export interface IngestLogInput {
  timestamp: string;
  level: LogLevel;
  service: string;
  host?: string;
  message: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

export async function ingestLogs(
  workspaceId: string,
  sourceId: string,
  logs: IngestLogInput[]
) {
  if (logs.length === 0) return { accepted: 0 };

  // Check daily ingest cap before doing any DB work (now Redis-backed)
  const allowed = await checkDailyLimit(workspaceId, logs.length);
  if (!allowed) {
    // Throttled warn — checkDailyLimit already throttles its own warning
    // but we log a batch-level summary less frequently
    const last = lastLimitWarn.get(`drop:${workspaceId}`) || 0;
    if (Date.now() - last > LIMIT_WARN_THROTTLE_MS) {
      lastLimitWarn.set(`drop:${workspaceId}`, Date.now());
      log.warn(`Dropping ${logs.length} logs for workspace ${workspaceId} (daily limit)`);
    }
    return { accepted: 0 };
  }

  const values = logs.map((l) => ({
    timestamp: new Date(l.timestamp),
    workspaceId,
    sourceId,
    level: l.level,
    service: l.service,
    host: l.host || null,
    message: l.message,
    metadata: l.metadata || null,
    traceId: l.traceId || null,
  }));

  // Insert in chunks of 500 to avoid oversized single INSERT statements
  const CHUNK_SIZE = 500;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    await db.insert(logEntry).values(values.slice(i, i + CHUNK_SIZE));
  }

  // Publish a compact notification to Redis for live tail subscribers.
  // Do NOT send the full log payload — send a summary so SSE clients
  // know new logs exist and can fetch them if they want.
  const notify = JSON.stringify({
    t: 'new',
    ws: workspaceId,
    src: sourceId,
    n: values.length,
    ts: values[values.length - 1].timestamp.toISOString(),
  });
  await redisConnection.publish(`logs:${workspaceId}`, notify).catch(() => {});

  return { accepted: values.length };
}

export interface QueryLogsFilters {
  workspaceId: string;
  sourceId?: string;
  service?: string;
  level?: LogLevel;
  host?: string;
  from?: Date;
  to?: Date;
  search?: string;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export async function queryLogs(filters: QueryLogsFilters) {
  const limit = Math.min(filters.limit || 500, 1000);
  const conditions: SQL[] = [sql`${logEntry.workspaceId} = ${filters.workspaceId}`];

  if (filters.sourceId) conditions.push(sql`${logEntry.sourceId} = ${filters.sourceId}`);
  if (filters.service) conditions.push(sql`${logEntry.service} = ${filters.service}`);
  if (filters.level) conditions.push(sql`${logEntry.level} = ${filters.level}`);
  if (filters.host) conditions.push(sql`${logEntry.host} = ${filters.host}`);
  if (filters.from) conditions.push(sql`${logEntry.timestamp} >= ${filters.from.toISOString()}`);
  if (filters.to) conditions.push(sql`${logEntry.timestamp} <= ${filters.to.toISOString()}`);
  if (filters.traceId) conditions.push(sql`${logEntry.traceId} = ${filters.traceId}`);

  if (filters.search) {
    const parsed = parseQuery(filters.search);
    if (parsed.rawSql) {
      conditions.push(sql.raw(parsed.rawSql) as SQL);
    } else {
      const clauseSqls = parsed.clauses.map((c) => clauseToSQL(c));
      if (clauseSqls.length > 0) {
        const connector = parsed.booleans.includes('OR') ? ' OR ' : ' AND ';
        const joined = clauseSqls.reduce((acc, s, i) => i === 0 ? s : sql`${acc}${sql.raw(connector)}${s}`);
        conditions.push(sql`(${joined})`);
      }
      if (parsed.freeText) {
        conditions.push(sql`${logEntry.message} ILIKE ${`%${parsed.freeText}%`}`);
      }
    }
  }

  const result = await db.execute(sql`
    SELECT * FROM ${logEntry}
    WHERE ${and(...conditions)}
    ORDER BY ${logEntry.timestamp} DESC
    LIMIT ${limit}
    OFFSET ${filters.offset || 0}
  `);

  return result;
}

function clauseToSQL(clause: QueryClause): SQL {
  const col = getColumnName(clause.field);

  switch (clause.type) {
    case 'field':
      if (clause.negated) {
        return sql`${col} != ${clause.value}`;
      }
      return sql`${col} = ${clause.value}`;
    case 'negate':
      return sql`${col} != ${clause.value}`;
    case 'phrase':
      return sql`${col} ILIKE ${`%${clause.value}%`}`;
    case 'regex':
      return sql`${col} ~ ${String(clause.value).slice(1, -1)}`;
    case 'metadata': {
      const metaCol = sql`(jsonb_path_query(${logEntry.metadata}, '$.${clause.field}'))`;
      if (typeof clause.value === 'string' && clause.value.match(/^-?\d+$/)) {
        const num = Number(clause.value);
        switch (clause.operator) {
          case '>': return sql`${metaCol}::numeric > ${num}`;
          case '<': return sql`${metaCol}::numeric < ${num}`;
          case '>=': return sql`${metaCol}::numeric >= ${num}`;
          case '<=': return sql`${metaCol}::numeric <= ${num}`;
          case '!=': return sql`${metaCol}::text != ${String(clause.value)}`;
          default: return sql`${metaCol}::text = ${String(clause.value)}`;
        }
      }
      if (clause.operator === '!=' || clause.operator === '~') {
        return sql`${metaCol}::text != ${String(clause.value)}`;
      }
      return sql`${metaCol}::text = ${String(clause.value)}`;
    }
    case 'glob':
      return sql`${col} ILIKE ${String(clause.value)}`;
    case 'sql':
      return sql`${sql.raw(String(clause.value))}`;
    default:
      return sql`1=1`;
  }
}

function getColumnName(field: string): SQL {
  switch (field) {
    case 'service': return sql`${logEntry.service}`;
    case 'level': return sql`${logEntry.level}`;
    case 'host': return sql`${logEntry.host}`;
    case 'traceId': return sql`${logEntry.traceId}`;
    case 'sourceId': return sql`${logEntry.sourceId}`;
    case 'message': return sql`${logEntry.message}`;
    default: return sql`${logEntry.message}`;
  }
}

export async function getLogMetrics(
  workspaceId: string,
  from: Date,
  to: Date,
  bucketMinutes = 1
) {
  const safeBucketMinutes = Math.max(1, Math.min(bucketMinutes, 1440));
  const result = await db.execute(sql`
    SELECT
      time_bucket(INTERVAL '1 minute' * ${safeBucketMinutes}, ${logEntry.timestamp}) AS bucket,
      ${logEntry.level},
      ${logEntry.service},
      count(*)::int AS count
    FROM ${logEntry}
    WHERE ${logEntry.workspaceId} = ${workspaceId}
      AND ${logEntry.timestamp} >= ${from.toISOString()}
      AND ${logEntry.timestamp} <= ${to.toISOString()}
    GROUP BY bucket, ${logEntry.level}, ${logEntry.service}
    ORDER BY bucket DESC
  `);

  return result;
}
