import type { FastifyInstance } from 'fastify';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';
import { listIntegrations, createIntegrationWithSources, disableIntegration, deleteIntegration } from './integrations.service.js';
import { createIntegrationSchema } from './integrations.schemas.js';
import { getConnector } from './connectors/index.js';

export default async function integrationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;
    return listIntegrations(request.workspace!.id);
  });

  app.post('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = createIntegrationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    try {
      const integration = await createIntegrationWithSources({
        workspaceId: request.workspace!.id,
        ...body.data,
      });
      return reply.status(201).send(integration);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to create integration' });
    }
  });

  app.patch('/:id/disable', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    try {
      await disableIntegration(id);
      return { ok: true };
    } catch (err) {
      return reply.status(404).send({ error: err instanceof Error ? err.message : 'Integration not found' });
    }
  });

  app.delete('/:id', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { id } = request.params as { id: string };
    try {
      await deleteIntegration(id);
      return reply.status(204).send();
    } catch (err) {
      return reply.status(404).send({ error: err instanceof Error ? err.message : 'Integration not found' });
    }
  });

  app.post('/test-connection', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = createIntegrationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const connector = getConnector(body.data.provider);
    if (!connector) {
      return reply.status(400).send({ error: `Unknown provider: ${body.data.provider}` });
    }

    try {
      await connector.testConnection({}, body.data.secret);
      return { ok: true };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Connection test failed' });
    }
  });

  app.post('/discover', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = createIntegrationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const connector = getConnector(body.data.provider);
    if (!connector) {
      return reply.status(400).send({ error: `Unknown provider: ${body.data.provider}` });
    }

    try {
      const entities = await connector.discoverEntities({}, body.data.secret);
      return { entities };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Discovery failed' });
    }
  });
}
