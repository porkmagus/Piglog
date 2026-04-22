import type { FastifyInstance } from 'fastify';
import { eq, and, gte, sql, count, desc } from 'drizzle-orm';
import { logEntry } from '@piglog/db';
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
        AND ${logEntry.timestamp} >= ${from}
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
      volume: volume.rows || [],
      levels,
      services,
      hosts,
      total24h: Number(totals[0]?.count || 0),
    };
  });
}
