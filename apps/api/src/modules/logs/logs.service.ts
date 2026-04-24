import { eq, and, gte, lte, desc, sql, ilike } from 'drizzle-orm';
import { db, logEntry, logSource, logLevelEnum } from '@piglog/db';
import type { LogLevel } from '@piglog/db';
import { redisConnection } from '../../queues/index.js';

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

  const values = logs.map((log) => ({
    timestamp: new Date(log.timestamp),
    workspaceId,
    sourceId,
    level: log.level,
    service: log.service,
    host: log.host || null,
    message: log.message,
    metadata: log.metadata || null,
    traceId: log.traceId || null,
  }));

  await db.insert(logEntry).values(values);

  // Publish to Redis for live tail subscribers
  for (const log of values) {
    redisConnection.publish(`logs:${log.workspaceId}`, JSON.stringify(log));
  }

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
  const conditions = [eq(logEntry.workspaceId, filters.workspaceId)];

  if (filters.sourceId) conditions.push(eq(logEntry.sourceId, filters.sourceId));
  if (filters.service) conditions.push(eq(logEntry.service, filters.service));
  if (filters.level) conditions.push(eq(logEntry.level, filters.level));
  if (filters.host) conditions.push(eq(logEntry.host, filters.host));
  if (filters.from) conditions.push(gte(logEntry.timestamp, filters.from));
  if (filters.to) conditions.push(lte(logEntry.timestamp, filters.to));
  if (filters.traceId) conditions.push(eq(logEntry.traceId, filters.traceId));
  if (filters.search) {
    conditions.push(ilike(logEntry.message, `%${filters.search}%`));
  }

  const rows = await db
    .select()
    .from(logEntry)
    .where(and(...conditions))
    .orderBy(desc(logEntry.timestamp))
    .limit(limit)
    .offset(filters.offset || 0);

  return rows;
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
