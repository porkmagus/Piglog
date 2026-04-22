import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { logSource } from '@piglog/db';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';
import { createSource, listSources, getSource, regenerateApiKey, deleteSource } from './sources.service.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['http', 'syslog', 'filebeat', 'vector']),
  config: z.record(z.string(), z.unknown()).optional(),
});

export default async function sourceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;
    return listSources(request.workspace!.id);
  });

  app.post('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const source = await createSource(request.workspace!.id, body.data);
    return reply.status(201).send(source);
  });

  app.get('/:sourceId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { sourceId } = request.params as { sourceId: string };
    const source = await getSource(request.workspace!.id, sourceId);
    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }
    return source;
  });

  app.post('/:sourceId/regenerate-key', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { sourceId } = request.params as { sourceId: string };
    const source = await regenerateApiKey(request.workspace!.id, sourceId);
    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }
    return source;
  });

  app.delete('/:sourceId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { sourceId } = request.params as { sourceId: string };
    await deleteSource(request.workspace!.id, sourceId);
    return reply.status(204).send();
  });
}
