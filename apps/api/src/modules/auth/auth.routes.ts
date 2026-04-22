import type { FastifyInstance } from 'fastify';
import { getConfiguredAuthProviders } from '../../plugins/auth.js';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/providers', async (_request, reply) => {
    const providers = getConfiguredAuthProviders();
    return reply.send({
      social: providers,
    });
  });
}
