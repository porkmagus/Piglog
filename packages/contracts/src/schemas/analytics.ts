import { z } from 'zod';

export const analyticsOverviewResponseSchema = z.object({
  volume: z.array(z.object({
    bucket: z.string(),
    count: z.number(),
  })),
  levels: z.array(z.object({
    level: z.string(),
    count: z.number(),
  })),
  services: z.array(z.object({
    service: z.string(),
    count: z.number(),
  })),
  hosts: z.array(z.object({
    host: z.string().nullable(),
    count: z.number(),
  })),
  total24h: z.number(),
});

export type AnalyticsOverviewResponse = z.infer<typeof analyticsOverviewResponseSchema>;
