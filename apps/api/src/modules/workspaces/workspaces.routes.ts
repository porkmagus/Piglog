import type { FastifyInstance } from 'fastify';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { z } from 'zod';
import { workspace, workspaceMember, billing, invitation, user } from '@piglog/db';
import { db } from '@piglog/db';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).optional().default('MEMBER'),
});

export default async function workspaceRoutes(app: FastifyInstance) {
  // Public join route (no auth required, user must be logged in)
  app.post('/join', async (request: AuthenticatedRequest, reply) => {
    const body = request.body as { inviteCode?: string };
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!body?.inviteCode) {
      return reply.status(400).send({ error: 'Invite code required' });
    }

    const ws = await db.query.workspace.findFirst({
      where: and(eq(workspace.inviteCode, body.inviteCode), isNull(workspace.deletedAt)),
    });
    if (!ws) {
      return reply.status(404).send({ error: 'Invalid invite code' });
    }

    // Check if already a member
    const existing = await db.query.workspaceMember.findFirst({
      where: and(
        eq(workspaceMember.workspaceId, ws.id),
        eq(workspaceMember.userId, request.user.id),
        isNull(workspaceMember.deletedAt)
      ),
    });
    if (existing) {
      return reply.status(409).send({ error: 'Already a member' });
    }

    await db.insert(workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: ws.id,
      userId: request.user.id,
      role: 'MEMBER',
    });

    return { id: ws.id, name: ws.name, slug: ws.slug };
  });

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
      where: eq(workspace.slug, body.data.slug.toLowerCase()),
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

  const patchSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  });

  app.patch('/:workspaceId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = patchSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }
    const { name, slug } = body.data;
    if (!name && !slug) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }

    const updateData: Partial<{ name: string; slug: string }> = {};
    if (name) updateData.name = name.trim();
    if (slug) updateData.slug = slug.toLowerCase();

    await db.update(workspace)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(workspace.id, request.workspace!.id));

    const ws = await db.query.workspace.findFirst({
      where: eq(workspace.id, request.workspace!.id),
    });
    return ws;
  });

  app.delete('/:workspaceId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    // Only owners can delete
    if (request.workspace!.role !== 'OWNER') {
      return reply.status(403).send({ error: 'Only owners can delete workspaces' });
    }

    await db.update(workspace)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspace.id, request.workspace!.id));

    return reply.status(204).send();
  });

  // Members
  app.get('/:workspaceId/members', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const members = await db.query.workspaceMember.findMany({
      where: and(
        eq(workspaceMember.workspaceId, request.workspace!.id),
        isNull(workspaceMember.deletedAt)
      ),
      with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  });

  // Invitations
  app.get('/:workspaceId/invitations', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const invites = await db.query.invitation.findMany({
      where: and(
        eq(invitation.workspaceId, request.workspace!.id),
        eq(invitation.status, 'PENDING'),
        gt(invitation.expiresAt, new Date())
      ),
      with: { invitedBy: { columns: { id: true, name: true, email: true } } },
    });

    return invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    }));
  });

  app.post('/:workspaceId/invitations', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = inviteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    // Only owners and admins can invite
    const role = request.workspace!.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Only owners and admins can invite members' });
    }

    // Check if invited email already has a user account and is a member
    const invitedUser = await db.query.user.findFirst({
      where: eq(user.email, body.data.email),
    });
    if (invitedUser) {
      const existingMember = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, request.workspace!.id),
          eq(workspaceMember.userId, invitedUser.id),
          isNull(workspaceMember.deletedAt)
        ),
      });
      if (existingMember) {
        return reply.status(409).send({ error: 'User is already a member' });
      }
    }

    // Check for existing pending invite
    const existingInvite = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.workspaceId, request.workspace!.id),
        eq(invitation.email, body.data.email),
        eq(invitation.status, 'PENDING'),
        gt(invitation.expiresAt, new Date())
      ),
    });
    if (existingInvite) {
      return reply.status(409).send({ error: 'Pending invitation already exists' });
    }

    const invite = await db.insert(invitation).values({
      id: crypto.randomUUID(),
      workspaceId: request.workspace!.id,
      email: body.data.email,
      role: body.data.role,
      token: crypto.randomUUID(),
      invitedById: request.user!.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).returning();

    return reply.status(201).send(invite[0]);
  });

  app.delete('/:workspaceId/invitations/:invitationId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { invitationId } = request.params as { invitationId: string };

    const role = request.workspace!.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Only owners and admins can cancel invitations' });
    }

    await db.delete(invitation).where(eq(invitation.id, invitationId));
    return reply.status(204).send();
  });

  // Accept invitation (token-based)
  const acceptInviteSchema = z.object({ token: z.string().min(1) });

  app.post('/invitations/accept', async (request: AuthenticatedRequest, reply) => {
    const body = acceptInviteSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Token required' });
    }
    const { token } = body.data;

    const invite = await db.query.invitation.findFirst({
      where: and(
        eq(invitation.token, token),
        eq(invitation.status, 'PENDING'),
        gt(invitation.expiresAt, new Date())
      ),
    });
    if (!invite) {
      return reply.status(404).send({ error: 'Invalid or expired invitation' });
    }

    // Check if already a member
    const existing = await db.query.workspaceMember.findFirst({
      where: and(
        eq(workspaceMember.workspaceId, invite.workspaceId),
        eq(workspaceMember.userId, request.user!.id),
        isNull(workspaceMember.deletedAt)
      ),
    });
    if (existing) {
      return reply.status(409).send({ error: 'Already a member' });
    }

    await db.insert(workspaceMember).values({
      id: crypto.randomUUID(),
      workspaceId: invite.workspaceId,
      userId: request.user!.id,
      role: invite.role,
    });

    await db.update(invitation)
      .set({ status: 'ACCEPTED', updatedAt: new Date() })
      .where(eq(invitation.id, invite.id));

    return { success: true };
  });
}
