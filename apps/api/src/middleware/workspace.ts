import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq, and, isNull, or } from 'drizzle-orm';
import { workspaceMember, workspace } from '@piglog/db';

export interface WorkspaceRequest extends FastifyRequest {
  workspace?: {
    id: string;
    slug: string;
    role: string;
  };
}

export const workspaceContextPlugin = fp(async (_fastify: FastifyInstance) => {
  // Type extension only
});

export async function extractWorkspace(request: WorkspaceRequest, reply: FastifyReply) {
  const { workspaceId } = request.params as { workspaceId: string };

  if (!workspaceId) {
    reply.status(400).send({ error: 'Workspace identifier is required' });
    return;
  }

  const userId = (request as any).user?.id;
  if (!userId) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const db = request.server.db;

  // Resolve workspace by ID or slug
  const ws = await db.query.workspace.findFirst({
    where: and(
      or(eq(workspace.id, workspaceId), eq(workspace.slug, workspaceId)),
      isNull(workspace.deletedAt)
    ),
    columns: { id: true, slug: true },
  });

  if (!ws) {
    reply.status(404).send({ error: 'Workspace not found' });
    return;
  }

  // Verify membership
  const member = await db.query.workspaceMember.findFirst({
    where: and(
      eq(workspaceMember.workspaceId, ws.id),
      eq(workspaceMember.userId, userId),
      isNull(workspaceMember.deletedAt)
    ),
  });

  if (!member) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have access to this workspace',
    });
    return;
  }

  request.workspace = {
    id: ws.id,
    slug: ws.slug,
    role: member.role,
  };
}
