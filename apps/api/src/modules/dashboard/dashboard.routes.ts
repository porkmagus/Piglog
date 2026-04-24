import type { FastifyInstance } from 'fastify';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';
import { getMergedLayout, savePersonalLayout, deletePersonalLayout, type DashboardWidget } from './dashboard.service.js';

const widgetSchema = {
  type: 'object',
  required: ['id', 'type', 'col', 'row', 'w', 'h', 'config'],
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    col: { type: 'integer' },
    row: { type: 'integer' },
    w: { type: 'integer' },
    h: { type: 'integer' },
    config: { type: 'object' },
  },
};

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/layout', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const userId = request.user?.id || null;
    const result = await getMergedLayout(request.workspace!.id, userId);
    return result;
  });

  app.put('/layout', {
    schema: {
      body: {
        type: 'object',
        required: ['widgets'],
        properties: {
          widgets: { type: 'array', items: widgetSchema },
          hiddenIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    if (!request.user?.id) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const body = request.body as { widgets: DashboardWidget[]; hiddenIds?: string[] };
    await savePersonalLayout(request.workspace!.id, request.user.id, body.widgets, body.hiddenIds || []);
    return { ok: true };
  });

  app.delete('/layout', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    if (!request.user?.id) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    await deletePersonalLayout(request.workspace!.id, request.user.id);
    return { ok: true };
  });
}
