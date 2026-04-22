import type { FastifyInstance } from 'fastify';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/providers', async (_request, reply) => {
    const { github, google } = app.auth.options.socialProviders || {};
    return reply.send({
      social: {
        github: Boolean(github),
        google: Boolean(google),
      },
    });
  });
}
