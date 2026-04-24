import { z } from 'zod';

export const dashboardWidgetSchema = z.object({
  id: z.string(),
  type: z.string(),
  col: z.number(),
  row: z.number(),
  w: z.number(),
  h: z.number(),
  config: z.record(z.string(), z.unknown()),
});

export const dashboardLayoutResponseSchema = z.object({
  widgets: z.array(dashboardWidgetSchema),
  isPersonal: z.boolean(),
});

export const dashboardSaveResponseSchema = z.object({
  ok: z.boolean(),
});

export const sqlQueryResponseSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  rowCount: z.number(),
});

export const sourcesResponseSchema = z.array(z.object({
  source: z.string(),
  count: z.number(),
}));

export const errorsResponseSchema = z.array(z.object({
  bucket: z.string(),
  total: z.number(),
  errors: z.number(),
}));

export const alertsResponseSchema = z.array(z.object({
  id: z.string(),
  ruleName: z.string(),
  status: z.string(),
  actualCount: z.number(),
  threshold: z.number(),
  triggeredAt: z.string(),
  resolvedAt: z.union([z.string(), z.null()]),
}));
