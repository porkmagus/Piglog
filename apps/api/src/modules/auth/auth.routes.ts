import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { user } from '@piglog/db';
import { db } from '@piglog/db';
import { getConfiguredAuthProviders } from '../../plugins/auth.js';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const changeEmailSchema = z.object({
  email: z.string().email(),
});

export default async function authRoutes(app: FastifyInstance) {
  app.get('/providers', async (_request, reply) => {
    const providers = getConfiguredAuthProviders();
    return reply.send({
      social: providers,
    });
  });

  app.post('/change-password', {
    onRequest: [async (request: AuthenticatedRequest, reply) => {
      await requireAuth(request, reply);
    }],
  }, async (request: AuthenticatedRequest, reply) => {
    const body = changePasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
    }

    const response = await app.auth.api.changePassword({
      headers,
      body: {
        currentPassword: body.data.currentPassword,
        newPassword: body.data.newPassword,
        revokeOtherSessions: false,
      },
    });

    if (!response) {
      return reply.status(400).send({ error: 'Current password is incorrect' });
    }
    return { ok: true };
  });

  app.post('/change-email', {
    onRequest: [async (request: AuthenticatedRequest, reply) => {
      await requireAuth(request, reply);
    }],
  }, async (request: AuthenticatedRequest, reply) => {
    const body = changeEmailSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const existing = await db.query.user.findFirst({
      where: eq(user.email, body.data.email),
    });
    if (existing && existing.id !== request.user!.id) {
      return reply.status(409).send({ error: 'Email already in use' });
    }

    await db.update(user)
      .set({ email: body.data.email, emailVerified: false })
      .where(eq(user.id, request.user!.id));

    return { ok: true };
  });
}
