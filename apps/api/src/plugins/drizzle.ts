import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { db } from '@piglog/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db;
  }
}

export const drizzlePlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('db', db);
});
