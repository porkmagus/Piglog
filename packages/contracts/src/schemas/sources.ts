import { z } from 'zod';

export const sourceListResponseSchema = z.array(z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string(),
  config: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  volume24h: z.number(),
  lastSeen: z.string().nullable(),
  isInternal: z.boolean(),
}));

export const sourceCreateResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string(),
  config: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const sourceRegenerateResponseSchema = z.object({
  id: z.string(),
  apiKey: z.string(),
});

export type SourceListResponse = z.infer<typeof sourceListResponseSchema>;
export type SourceCreateResponse = z.infer<typeof sourceCreateResponseSchema>;
export type SourceRegenerateResponse = z.infer<typeof sourceRegenerateResponseSchema>;
