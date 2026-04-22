import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logLevelEnum } from '@piglog/db';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';
import {
  createAlertRule,
  listAlertRules,
  getAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from './alerts.service.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  service: z.string().min(1).max(255),
  level: z.enum(logLevelEnum.enumValues).optional(),
  operator: z.enum(['GREATER_THAN', 'LESS_THAN', 'EQUALS']),
  threshold: z.number().int().min(1),
  windowMinutes: z.number().int().min(1).max(1440).optional().default(5),
  webhookUrl: z.string().url().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  service: z.string().min(1).max(255).optional(),
  level: z.enum(logLevelEnum.enumValues).optional().nullable(),
  operator: z.enum(['GREATER_THAN', 'LESS_THAN', 'EQUALS']).optional(),
  threshold: z.number().int().min(1).optional(),
  windowMinutes: z.number().int().min(1).max(1440).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).optional(),
  webhookUrl: z.string().url().optional().nullable(),
});

export default async function alertRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.get('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;
    return listAlertRules(request.workspace!.id);
  });

  app.post('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const rule = await createAlertRule(request.workspace!.id, body.data);
    return reply.status(201).send(rule);
  });

  app.get('/:ruleId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { ruleId } = request.params as { ruleId: string };
    const rule = await getAlertRule(request.workspace!.id, ruleId);
    if (!rule) return reply.status(404).send({ error: 'Rule not found' });
    return rule;
  });

  app.patch('/:ruleId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { ruleId } = request.params as { ruleId: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid body', issues: body.error.issues });
    }

    const rule = await updateAlertRule(request.workspace!.id, ruleId, body.data);
    if (!rule) return reply.status(404).send({ error: 'Rule not found' });
    return rule;
  });

  app.delete('/:ruleId', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const { ruleId } = request.params as { ruleId: string };
    await deleteAlertRule(request.workspace!.id, ruleId);
    return reply.status(204).send();
  });
}
