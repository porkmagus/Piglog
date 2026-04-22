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
import { redisConnection } from './queues/index.js';
import { getTrustedOrigins } from './lib/env.js';

export async function app(fastify: FastifyInstance) {
  const trustedOrigins = getTrustedOrigins();

  await fastify.register(cors, {
    origin: trustedOrigins,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: redisConnection,
    keyGenerator: (req) => req.user?.id || req.ip,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  await fastify.register(drizzlePlugin);
  await fastify.register(authPlugin);
  await fastify.register(workspaceContextPlugin);

  // Public routes
  await fastify.register(async function publicRoutes(app) {
    await app.register(healthRoutes, { prefix: '/health' });
    await app.register(authRoutes, { prefix: '/auth' });
    await app.register(logRoutes, { prefix: '/logs' });
  });

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
      } catch {
        // Not authenticated
      }
    });

    await app.register(workspaceRoutes, { prefix: '/workspaces' });
    await app.register(sourceRoutes, { prefix: '/workspaces/:workspaceId/sources' });
    await app.register(uploadLogRoutes, { prefix: '/workspaces/:workspaceId/uploads/logs' });
    await app.register(analyticsRoutes, { prefix: '/workspaces/:workspaceId/analytics' });
    await app.register(alertRoutes, { prefix: '/workspaces/:workspaceId/alerts' });
  });
}
