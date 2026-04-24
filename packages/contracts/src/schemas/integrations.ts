import { z } from 'zod';

export const integrationSourceResponseSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  externalId: z.string(),
  externalName: z.string(),
  status: z.string(),
  isEnabled: z.boolean(),
});

export const integrationListResponseSchema = z.array(z.object({
  id: z.string(),
  provider: z.string(),
  name: z.string(),
  status: z.string(),
  config: z.unknown(),
  errorMessage: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  sources: z.array(integrationSourceResponseSchema),
}));

export const integrationCreateResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: z.string(),
  name: z.string(),
  status: z.string(),
  config: z.unknown(),
  secret: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const integrationDiscoverResponseSchema = z.object({
  entities: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
});

export const integrationTestConnectionResponseSchema = z.object({
  ok: z.boolean(),
});

export type IntegrationListResponse = z.infer<typeof integrationListResponseSchema>;
export type IntegrationCreateResponse = z.infer<typeof integrationCreateResponseSchema>;
export type IntegrationDiscoverResponse = z.infer<typeof integrationDiscoverResponseSchema>;
