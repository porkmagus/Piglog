import { z } from 'zod';

export const alertRuleResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  service: z.string(),
  level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).nullable(),
  operator: z.string(),
  threshold: z.number(),
  windowMinutes: z.number(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']),
  webhookUrl: z.string().nullable(),
  lastTriggeredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const alertRuleListResponseSchema = z.array(alertRuleResponseSchema);

export const alertEventResponseSchema = z.object({
  id: z.string(),
  alertRuleId: z.string(),
  workspaceId: z.string(),
  actualCount: z.number(),
  threshold: z.number(),
  operator: z.string(),
  status: z.string(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  rule: z.unknown().optional(),
});

export const alertEventListResponseSchema = z.array(alertEventResponseSchema);

export type AlertRuleResponse = z.infer<typeof alertRuleResponseSchema>;
export type AlertEventResponse = z.infer<typeof alertEventResponseSchema>;
