import { z } from 'zod';

export const logEntryResponseSchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  workspaceId: z.string(),
  sourceId: z.string(),
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']),
  service: z.string(),
  host: z.string().nullable(),
  message: z.string(),
  metadata: z.unknown().nullable(),
  traceId: z.string().nullable(),
});

export const logQueryResponseSchema = z.array(logEntryResponseSchema);

export const logIngestResponseSchema = z.object({
  accepted: z.number(),
});

export type LogEntryResponse = z.infer<typeof logEntryResponseSchema>;
export type LogQueryResponse = z.infer<typeof logQueryResponseSchema>;
export type LogIngestResponse = z.infer<typeof logIngestResponseSchema>;
