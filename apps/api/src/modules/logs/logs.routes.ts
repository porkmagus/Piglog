import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logSource, logLevelEnum } from '@piglog/db';
import { parseSearchTokens } from '@piglog/contracts';
import { redisConnection, alertEvaluatorQueue } from '../../queues/index.js';
import liveLogRoutes from './logs.live.routes.js';
import { ingestLogs, queryLogs } from './logs.service.js';

const ingestSchema = z.object({
  logs: z.array(z.object({
    timestamp: z.string().datetime(),
    level: z.enum(logLevelEnum.enumValues),
    service: z.string().min(1).max(255),
    host: z.string().max(255).optional(),
    message: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    traceId: z.string().max(255).optional(),
  })),
});

const querySchema = z.object({
  workspaceId: z.string(),
  sourceId: z.string().optional(),
  service: z.string().optional(),
  level: z.enum(logLevelEnum.enumValues).optional(),
  host: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  traceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(500),
  offset: z.coerce.number().min(0).optional().default(0),
});

export default async function logRoutes(app: FastifyInstance) {
  // Public ingestion endpoint (API key auth) with rate limiting
  app.post('/ingest', {
    config: {
      rateLimit: {
        max: 1000,
        timeWindow: '1 minute',
        keyGenerator: (req: any) => req.headers['x-api-key'] || req.ip,
      },
    },
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return reply.status(401).send({ error: 'Missing X-API-Key header' });
    }

    const source = await app.db.query.logSource.findFirst({
      where: eq(logSource.apiKey, apiKey),
    });

    if (!source || source.deletedAt) {
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    const body = ingestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const result = await ingestLogs(source.workspaceId, source.id, body.data.logs);

    // Queue alert evaluation
    const services = new Set(body.data.logs.map((l) => l.service));
    for (const service of services) {
      const levels = new Set(body.data.logs.filter((l) => l.service === service).map((l) => l.level));
      for (const level of levels) {
        await alertEvaluatorQueue.add('evaluate-window', {
          workspaceId: source.workspaceId,
          service,
          level,
          windowMinutes: 5,
        }, {
          jobId: `${source.workspaceId}:${service}:${level}:${Math.floor(Date.now() / 60000)}`,
        });
      }
    }

    return reply.status(202).send(result);
  });

  await app.register(liveLogRoutes, { prefix: '/live' });

  // Protected query endpoint
  app.get('/query', async (request, reply) => {
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

    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'Invalid query', issues: query.error.issues });
    }

    // Parse token-based search if provided
    let service = query.data.service;
    let level = query.data.level;
    let host = query.data.host;
    let traceId = query.data.traceId;
    let search = query.data.search;

    if (search && search.includes(':')) {
      const tokens = parseSearchTokens(search);
      if (tokens.service) service = tokens.service;
      if (tokens.level) level = tokens.level;
      if (tokens.host) host = tokens.host;
      if (tokens.traceId) traceId = tokens.traceId;
      if (tokens.search) search = tokens.search;
      else search = undefined;
    }

    const rows = await queryLogs({
      workspaceId: query.data.workspaceId,
      sourceId: query.data.sourceId,
      service,
      level,
      host,
      from: query.data.from ? new Date(query.data.from) : undefined,
      to: query.data.to ? new Date(query.data.to) : undefined,
      search,
      traceId,
      limit: query.data.limit,
      offset: query.data.offset,
    });

    return rows;
  });
}
