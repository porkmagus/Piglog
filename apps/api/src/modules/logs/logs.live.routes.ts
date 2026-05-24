import type { FastifyInstance } from 'fastify';
import { eq, and, gte, sql, isNull, desc } from 'drizzle-orm';
import { logEntry, logSource, logLevelEnum, workspaceMember } from '@piglog/db';
import { redisConnection } from '../../queues/index.js';
import { db } from '@piglog/db';

/** Max SSE connection lifetime (1 hour) to prevent orphaned subscribers. */
const SSE_MAX_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Short-lived cache for live tail DB queries.
 * Prevents thundering herd when N SSE clients all receive the same
 * Redis pub/sub notification and each fire an identical DB query.
 */
const liveTailCache = new Map<string, { data: unknown[]; ts: number }>();
const LIVE_TAIL_CACHE_TTL_MS = 500; // 500ms coalesce window

export default async function liveLogRoutes(app: FastifyInstance) {
  app.get('/live', async (request, reply) => {
    const { workspaceId, sourceId, service, level } = request.query as {
      workspaceId: string;
      sourceId?: string;
      service?: string;
      level?: string;
    };

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId required' });
    }

    // Validate API key or session
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
    }
    const session = await app.auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Validate workspace membership
    const member = await db.query.workspaceMember.findFirst({
      where: and(
        eq(workspaceMember.workspaceId, workspaceId),
        eq(workspaceMember.userId, session.user.id),
        isNull(workspaceMember.deletedAt)
      ),
    });
    if (!member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this workspace' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Subscribe to Redis for new logs
    const subscriber = redisConnection.duplicate();
    const channel = `logs:${workspaceId}`;

    // Idempotent cleanup — safe to call multiple times
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      clearTimeout(lifetimeTimer);
      subscriber.unsubscribe(channel).catch((err) => {
        console.warn(`[live-logs] Redis unsubscribe ${channel}: ${err instanceof Error ? err.message : String(err)}`);
      });
      subscriber.disconnect();
    };

    // Max lifetime — force-close stale connections
    const lifetimeTimer = setTimeout(() => {
      cleanup();
      try { reply.raw.end(); } catch { /* already closed */ }
    }, SSE_MAX_LIFETIME_MS);

    await subscriber.subscribe(channel);

    // Keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n');
      } catch {
        cleanup();
      }
    }, 15000);

    // Send recent logs as initial burst (last 50)
    const recent = await db
      .select()
      .from(logEntry)
      .where(
        and(
          eq(logEntry.workspaceId, workspaceId),
          sourceId ? eq(logEntry.sourceId, sourceId) : undefined,
          service ? eq(logEntry.service, service) : undefined,
          level ? eq(logEntry.level, level as (typeof logLevelEnum.enumValues)[number]) : undefined
        )
      )
      .orderBy(desc(logEntry.timestamp))
      .limit(50);

    for (const entry of recent.reverse()) {
      try {
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch {
        cleanup();
        return;
      }
    }

    // Handle incoming Redis notifications (compact format from ingestLogs)
    subscriber.on('message', async (_chan, message) => {
      try {
        const parsed = JSON.parse(message);

        // Handle compact notification format: { t: 'new', ws, src, n, ts }
        if (parsed.t === 'new' && parsed.ws === workspaceId) {
          // Build cache key from notification + client filters
          const cacheKey = `${parsed.ts}:${parsed.src || ''}:${sourceId || ''}:${service || ''}:${level || ''}`;
          const now = Date.now();
          const cached = liveTailCache.get(cacheKey);

          let newLogs: unknown[];
          if (cached && now - cached.ts < LIVE_TAIL_CACHE_TTL_MS) {
            newLogs = cached.data;
          } else {
            // Fetch the newly inserted logs from DB
            const conditions = [eq(logEntry.workspaceId, workspaceId)];
            if (sourceId) conditions.push(eq(logEntry.sourceId, sourceId));
            if (service) conditions.push(eq(logEntry.service, service));
            if (level) conditions.push(eq(logEntry.level, level as (typeof logLevelEnum.enumValues)[number]));
            if (parsed.src && !sourceId) conditions.push(eq(logEntry.sourceId, parsed.src));

            // Fetch logs newer than the notification timestamp
            conditions.push(gte(logEntry.timestamp, new Date(parsed.ts)));

            newLogs = await db
              .select()
              .from(logEntry)
              .where(and(...conditions))
              .orderBy(desc(logEntry.timestamp))
              .limit(parsed.n || 100);

            liveTailCache.set(cacheKey, { data: newLogs, ts: now });

            // Prune expired cache entries in the same event loop tick
            for (const [k, v] of liveTailCache) {
              if (now - v.ts > LIVE_TAIL_CACHE_TTL_MS * 2) liveTailCache.delete(k);
            }
          }

          for (const entry of (newLogs as typeof recent).reverse()) {
            reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
          }
        } else {
          // Legacy format: direct log payload (backwards compatibility)
          const logs = Array.isArray(parsed) ? parsed : [parsed];
          for (const entry of logs) {
            if (sourceId && entry.sourceId !== sourceId) continue;
            if (service && entry.service !== service) continue;
            if (level && entry.level !== level) continue;
            reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
          }
        }
      } catch {
        cleanup();
      }
    });

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
  });
}
