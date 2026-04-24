import type { FastifyInstance } from 'fastify';
import { eq, and, gte, sql, count, desc } from 'drizzle-orm';
import { logEntry, alertEvent, alertRule } from '@piglog/db';
import { db } from '@piglog/db';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';

export default async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/overview', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const workspaceId = request.workspace!.id;
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Volume over time (hourly buckets)
    const volume = await db.execute(sql`
      SELECT
        time_bucket(INTERVAL '1 hour', ${logEntry.timestamp}) AS bucket,
        count(*)::int AS count
      FROM ${logEntry}
      WHERE ${logEntry.workspaceId} = ${workspaceId}
        AND ${logEntry.timestamp} >= ${from.toISOString()}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    // Level breakdown
    const levels = await db
      .select({
        level: logEntry.level,
        count: count(),
      })
      .from(logEntry)
      .where(and(
        eq(logEntry.workspaceId, workspaceId),
        gte(logEntry.timestamp, from)
      ))
      .groupBy(logEntry.level);

    // Top services
    const services = await db
      .select({
        service: logEntry.service,
        count: count(),
      })
      .from(logEntry)
      .where(and(
        eq(logEntry.workspaceId, workspaceId),
        gte(logEntry.timestamp, from)
      ))
      .groupBy(logEntry.service)
      .orderBy(desc(count()))
      .limit(10);

    // Top hosts
    const hosts = await db
      .select({
        host: logEntry.host,
        count: count(),
      })
      .from(logEntry)
      .where(and(
        eq(logEntry.workspaceId, workspaceId),
        gte(logEntry.timestamp, from),
        sql`${logEntry.host} IS NOT NULL`
      ))
      .groupBy(logEntry.host)
      .orderBy(desc(count()))
      .limit(10);

    // Total counts
    const totals = await db
      .select({ count: count() })
      .from(logEntry)
      .where(and(
        eq(logEntry.workspaceId, workspaceId),
        gte(logEntry.timestamp, from)
      ));

    return {
      volume: volume || [],
      levels,
      services,
      hosts,
      total24h: Number(totals[0]?.count || 0),
    };
  });

  // Top sources
  app.get('/sources', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const workspaceId = request.workspace!.id;
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const limit = Number((request.query as Record<string, unknown>).limit || 10);

    const { logSource } = await import('@piglog/db');
    const sources = await db.execute(sql`
      SELECT ls.name AS source, count(le.*)::int AS count
      FROM ${logEntry} le
      INNER JOIN ${logSource} ls ON le.source_id = ls.id
      WHERE le.workspace_id = ${workspaceId}
        AND le.timestamp >= ${from.toISOString()}
      GROUP BY ls.name
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return sources || [];
  });

  // Error rate over time
  app.get('/errors', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const workspaceId = request.workspace!.id;
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const errors = await db.execute(sql`
      SELECT
        time_bucket(INTERVAL '1 hour', ${logEntry.timestamp}) AS bucket,
        count(*)::int AS total,
        count(*) FILTER (WHERE ${logEntry.level} IN ('ERROR', 'FATAL'))::int AS errors
      FROM ${logEntry}
      WHERE ${logEntry.workspaceId} = ${workspaceId}
        AND ${logEntry.timestamp} >= ${from.toISOString()}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    return errors || [];
  });

  // Recent alerts
  app.get('/alerts', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const workspaceId = request.workspace!.id;
    const limit = Number((request.query as Record<string, unknown>).limit || 10);

    const alerts = await db.execute(sql`
      SELECT
        ae.id,
        ar.name AS rule_name,
        ae.status,
        ae.actual_count AS actual_count,
        ae.threshold,
        ae.created_at AS triggered_at,
        ae.resolved_at
      FROM alert_event ae
      INNER JOIN alert_rule ar ON ae.alert_rule_id = ar.id
      WHERE ae.workspace_id = ${workspaceId}
      ORDER BY ae.created_at DESC
      LIMIT ${limit}
    `);

    return (alerts || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      ruleName: String(row.rule_name),
      status: String(row.status),
      actualCount: Number(row.actual_count),
      threshold: Number(row.threshold),
      triggeredAt: String(row.triggered_at),
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    }));
  });

  // Custom SQL query
  app.post('/query', {
    schema: {
      body: {
        type: 'object',
        required: ['sql'],
        properties: {
          sql: { type: 'string', maxLength: 4096 },
          timeRange: { type: 'string', enum: ['1h', '6h', '24h', '7d'] },
        },
      },
    },
  }, async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { executeSandboxedQuery } = await import('./query.service.js');
    const body = request.body as { sql: string; timeRange?: string };

    try {
      const result = await executeSandboxedQuery(
        request.workspace!.id,
        body.sql,
        body.timeRange || '24h',
      );
      return result;
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Query execution failed',
      });
    }
  });
}
