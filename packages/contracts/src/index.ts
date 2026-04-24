import { z } from 'zod';

export const logLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const ingestLogSchema = z.object({
  timestamp: z.string().datetime(),
  level: logLevelSchema,
  service: z.string().min(1).max(255),
  host: z.string().max(255).optional(),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().max(255).optional(),
});

export const ingestBatchSchema = z.object({
  logs: z.array(ingestLogSchema).min(1).max(1000),
});

export const queryLogsSchema = z.object({
  workspaceId: z.string(),
  sourceId: z.string().optional(),
  service: z.string().optional(),
  level: logLevelSchema.optional(),
  host: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  traceId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(500),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type IngestLogInput = z.infer<typeof ingestLogSchema>;
export type IngestBatchInput = z.infer<typeof ingestBatchSchema>;
export type QueryLogsInput = z.infer<typeof queryLogsSchema>;

// Token-based search parser
export interface SearchTokens {
  service?: string;
  level?: LogLevel;
  host?: string;
  traceId?: string;
  search?: string;
}

export function parseSearchTokens(input: string): SearchTokens {
  const tokens: SearchTokens = {};
  const parts: string[] = [];
  const regex = /(\w+):([^\s]+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const [, key, value] = match;
    if (key === 'service') tokens.service = value;
    if (key === 'level') {
      const upper = value.toUpperCase();
      if (['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(upper)) {
        tokens.level = upper as LogLevel;
      }
    }
    if (key === 'host') tokens.host = value;
    if (key === 'traceId') tokens.traceId = value;
  }

  // Everything else is free text search
  const remaining = input.replace(regex, '').trim();
  if (remaining) {
    tokens.search = remaining;
  }

  return tokens;
}

export function tokensToQueryString(tokens: SearchTokens): string {
  const parts: string[] = [];
  if (tokens.service) parts.push(`service:${tokens.service}`);
  if (tokens.level) parts.push(`level:${tokens.level.toLowerCase()}`);
  if (tokens.host) parts.push(`host:${tokens.host}`);
  if (tokens.traceId) parts.push(`traceId:${tokens.traceId}`);
  if (tokens.search) parts.push(tokens.search);
  return parts.join(' ');
}

// Response schemas (contract tests)
export * from './schemas/index.js';
