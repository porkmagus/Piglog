import type { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { workspace, workspaceMember, billing } from '@piglog/db';
import { db } from '@piglog/db';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
});

export default async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/', async (request: AuthenticatedRequest) => {
    const memberships = await request.server.db.query.workspaceMember.findMany({
      where: and(
        eq(workspaceMember.userId, request.user!.id),
        isNull(workspaceMember.deletedAt)
      ),
      with: {
        workspace: true,
      },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    }));
  });

  app.post('/', async (request: AuthenticatedRequest, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const existing = await db.query.workspace.findFirst({
      where: eq(workspace.slug, body.data.slug),
    });
    if (existing) {
      return reply.status(409).send({ error: 'Slug already taken' });
    }

    const ws = await db.insert(workspace).values({
      id: crypto.randomUUID(),
      name: body.data.name,
      slug: body.data.slug,
      ownerId: request.user!.id,
      inviteCode: crypto.randomUUID(),
    }).returning();

    await db.insert(workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: ws[0].id,
      userId: request.user!.id,
      role: 'OWNER',
    });

    await db.insert(billing).values({
      id: crypto.randomUUID(),
      workspaceId: ws[0].id,
    });

    return reply.status(201).send(ws[0]);
  });

  app.get('/:workspaceId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const ws = await request.server.db.query.workspace.findFirst({
      where: eq(workspace.id, request.workspace!.id),
    });

    if (!ws) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    return ws;
  });
}
