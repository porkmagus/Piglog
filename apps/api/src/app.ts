import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { drizzlePlugin } from './plugins/drizzle.js';
import { authPlugin, type AuthenticatedRequest } from './plugins/auth.js';
import { workspaceContextPlugin } from './middleware/workspace.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import workspaceRoutes from './modules/workspaces/workspaces.routes.js';
import logRoutes from './modules/logs/logs.routes.js';
import sourceRoutes from './modules/sources/sources.routes.js';
import uploadLogRoutes from './modules/uploads/upload-logs.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import alertRoutes from './modules/alerts/alerts.routes.js';
import integrationRoutes from './modules/integrations/integrations.routes.js';
import { redisConnection } from './queues/index.js';
import { getTrustedOrigins } from './lib/env.js';
import { startSyslogServer } from './lib/syslog-server.js';
import { startSnmpServer } from './lib/snmp-server.js';
import { getGlobalRateLimitKey, shouldBypassGlobalRateLimit } from './lib/rate-limit.js';

export async function app(fastify: FastifyInstance) {
  const trustedOrigins = getTrustedOrigins();

  // Global error handler for unhandled route errors
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error({ err: error }, 'Unhandled route error');
    if (reply.sent) return;
    reply.status(500).send({ error: 'Internal server error' });
  });

  await fastify.register(cors, {
    origin: trustedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: redisConnection,
    keyGenerator: (req) => getGlobalRateLimitKey(req),
    allowList: (req) => req.method === 'OPTIONS' || shouldBypassGlobalRateLimit(req),
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  await fastify.register(drizzlePlugin);
  await fastify.register(workspaceContextPlugin);

  // Public routes — register custom auth routes BEFORE better-auth catch-all
  await fastify.register(async function publicRoutes(app) {
    await app.register(healthRoutes, { prefix: '/health' });
    await app.register(authRoutes, { prefix: '/auth' });
    await app.register(logRoutes, { prefix: '/logs' });
  });

  await fastify.register(authPlugin);

  // Protected routes
  await fastify.register(async function protectedRoutes(app) {
    app.addHook('onRequest', async (request: AuthenticatedRequest, _reply) => {
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value !== undefined) {
            headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
          }
        }
        const session = await app.auth.api.getSession({ headers });
        if (session?.user) {
          request.user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || null,
            image: session.user.image || null,
          };
        }
      } catch (err) {
        app.log.debug({ err }, 'Auth session extraction failed');
      }
    });

    await app.register(workspaceRoutes, { prefix: '/workspaces' });
    await app.register(sourceRoutes, { prefix: '/workspaces/:workspaceId/sources' });
    await app.register(uploadLogRoutes, { prefix: '/workspaces/:workspaceId/uploads/logs' });
    await app.register(analyticsRoutes, { prefix: '/workspaces/:workspaceId/analytics' });
    await app.register(alertRoutes, { prefix: '/workspaces/:workspaceId/alerts' });
    await app.register(integrationRoutes, { prefix: '/workspaces/:workspaceId/integrations' });
  });

  // Start syslog listener (outside Fastify HTTP stack)
  await startSyslogServer();

  // Start SNMP trap listener
  await startSnmpServer();
}
