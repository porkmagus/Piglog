import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '@piglog/db';
import { redisConnection } from '../../queues/index.js';

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/ready', async (request, reply) => {
    try {
      // Check DB
      await db.execute(sql`SELECT 1`);
      // Check Redis
      await redisConnection.ping();
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch (err: any) {
      request.log.error({ err }, 'Health check failed');
      return reply.status(503).send({
        status: 'not_ready',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
