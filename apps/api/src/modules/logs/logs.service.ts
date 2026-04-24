import { eq, and, gte, lte, desc, sql, ilike, type SQL } from 'drizzle-orm';
import { db, logEntry, logSource, logLevelEnum } from '@piglog/db';
import type { LogLevel } from '@piglog/db';
import { parseQuery, type QueryClause } from '@piglog/contracts';
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
  const conditions: SQL[] = [sql`${logEntry.workspaceId} = ${filters.workspaceId}`];
  const params: unknown[] = [];

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
  } else if (filters.search) {
    conditions.push(sql`${logEntry.message} ILIKE ${`%${filters.search}%`}`);
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
