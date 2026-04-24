import type { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { logSource } from '@piglog/db';
import { ingestLogs } from '../logs/logs.service.js';
import { requireAuth, type AuthenticatedRequest } from '../../plugins/auth.js';
import { extractWorkspace, type WorkspaceRequest } from '../../middleware/workspace.js';

const uploadQuerySchema = z.object({
  sourceId: z.string().min(1),
});

export default async function uploadLogRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  app.post('/', async (request: AuthenticatedRequest & WorkspaceRequest, reply) => {
    const query = uploadQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'Invalid query params', issues: query.error.issues });
    }
    await extractWorkspace(request, reply);
    if (reply.sent) return;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const sourceId = query.data.sourceId;

    const source = await app.db.query.logSource.findFirst({
      where: and(
        eq(logSource.id, sourceId),
        eq(logSource.workspaceId, request.workspace!.id),
        isNull(logSource.deletedAt)
      ),
    });

    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }

    const buffer = await data.toBuffer();
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    const logs: Array<{
      timestamp: string;
      level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'FATAL';
      service: string;
      message: string;
      metadata?: Record<string, unknown>;
    }> = [];

    const ext = data.filename.split('.').pop()?.toLowerCase();

    if (ext === 'jsonl') {
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          logs.push({
            timestamp: obj.timestamp || new Date().toISOString(),
            level: obj.level || 'INFO',
            service: obj.service || 'upload',
            message: obj.message || JSON.stringify(obj),
            metadata: obj,
          });
        } catch {
          // skip malformed lines
        }
      }
    } else {
      // Plain text / log file
      for (const line of lines) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'upload',
          message: line,
        });
      }
    }

    if (logs.length === 0) {
      return reply.status(400).send({ error: 'No valid log entries found in file' });
    }

    const result = await ingestLogs(request.workspace!.id, source.id, logs);
    return reply.status(202).send({ accepted: result.accepted, totalLines: lines.length });
  });
}
