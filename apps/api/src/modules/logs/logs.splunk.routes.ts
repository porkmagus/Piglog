import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { logSource, logLevelEnum } from '@piglog/db';
import { ingestLogs } from './logs.service.js';
import { z } from 'zod';

const splunkEventSchema = z.object({
  event: z.union([z.string(), z.record(z.string(), z.unknown())]),
  time: z.union([z.number(), z.string()]).optional(),
  host: z.string().optional(),
  sourcetype: z.string().optional(),
  source: z.string().optional(),
  index: z.string().optional(),
});

const splunkBatchSchema = z.array(splunkEventSchema).max(1000);

function parseSplunkTimestamp(time?: number | string): Date {
  if (typeof time === 'number') {
    // Splunk time is epoch seconds (or milliseconds if > 1e12)
    return time > 1e12 ? new Date(time) : new Date(time * 1000);
  }
  if (typeof time === 'string') {
    const parsed = new Date(time);
    if (!isNaN(parsed.getTime())) return parsed;
    const num = parseFloat(time);
    if (!isNaN(num)) return num > 1e12 ? new Date(num) : new Date(num * 1000);
  }
  return new Date();
}

function normalizeLevel(level: unknown): typeof logLevelEnum.enumValues[number] {
  if (typeof level !== 'string') return 'INFO';
  const upper = level.toUpperCase();
  if (logLevelEnum.enumValues.includes(upper as any)) {
    return upper as typeof logLevelEnum.enumValues[number];
  }
  // Common mappings
  if (upper === 'CRITICAL' || upper === 'CRIT' || upper === 'FATAL') return 'FATAL';
  if (upper === 'WARNING') return 'WARN';
  if (upper === 'DEBUG') return 'DEBUG';
  if (upper === 'ERROR') return 'ERROR';
  return 'INFO';
}

export default async function splunkHecRoutes(app: FastifyInstance) {
  app.post('/services/collector/event', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Splunk ')) {
      return reply.status(401).send({ text: 'Invalid token', code: 2 });
    }

    const token = authHeader.slice(7);
    const source = await app.db.query.logSource.findFirst({
      where: eq(logSource.apiKey, token),
    });

    if (!source || source.deletedAt) {
      return reply.status(403).send({ text: 'Invalid token', code: 3 });
    }

    let events: z.infer<typeof splunkEventSchema>[];
    try {
      const body = request.body;
      if (Array.isArray(body)) {
        events = splunkBatchSchema.parse(body);
      } else {
        events = [splunkEventSchema.parse(body)];
      }
    } catch {
      return reply.status(400).send({ text: 'Invalid data format', code: 7 });
    }

    const logs = events.map((evt) => {
      const timestamp = parseSplunkTimestamp(evt.time);

      let message: string;
      let level: typeof logLevelEnum.enumValues[number] = 'INFO';
      let service: string = evt.sourcetype || evt.source || 'splunk';
      let host: string | undefined = evt.host;
      let metadata: Record<string, unknown> = {};

      if (typeof evt.event === 'string') {
        message = evt.event;
      } else {
        const ev = evt.event as Record<string, unknown>;
        message =
          typeof ev.message === 'string'
            ? ev.message
            : typeof ev.msg === 'string'
              ? ev.msg
              : JSON.stringify(ev);
        level = normalizeLevel(ev.level);
        service =
          typeof ev.service === 'string'
            ? ev.service
            : typeof ev.logger === 'string'
              ? ev.logger
              : service;
        host = typeof ev.host === 'string' ? ev.host : host;
        metadata = ev;
      }

      return {
        timestamp: timestamp.toISOString(),
        level,
        service,
        host,
        message,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    });

    const result = await ingestLogs(source.workspaceId, source.id, logs);

    // Splunk HEC response format
    return reply.status(200).send({
      text: 'Success',
      code: 0,
      ackId: result.accepted,
    });
  });
}
