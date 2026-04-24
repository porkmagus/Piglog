import type { FastifyInstance } from 'fastify';
import { eq, and, gte, sql, isNull } from 'drizzle-orm';
import { logEntry, logSource, logLevelEnum, workspaceMember } from '@piglog/db';
import { redisConnection } from '../../queues/index.js';
import { db } from '@piglog/db';

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
    await subscriber.subscribe(channel);

    // Keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(':heartbeat\n\n');
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.disconnect();
    };

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
      .orderBy(sql`${logEntry.timestamp} DESC`)
      .limit(50);

    for (const log of recent) {
      try {
        reply.raw.write(`data: ${JSON.stringify(log)}\n\n`);
      } catch {
        cleanup();
        return;
      }
    }

    subscriber.on('message', (_chan, message) => {
      try {
        const log = JSON.parse(message);
        // Apply client filters
        if (sourceId && log.sourceId !== sourceId) return;
        if (service && log.service !== service) return;
        if (level && log.level !== level) return;
        reply.raw.write(`data: ${JSON.stringify(log)}\n\n`);
      } catch {
        cleanup();
      }
    });

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
  });
}
