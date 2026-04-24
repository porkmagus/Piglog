import { z } from 'zod';

export const createIntegrationSchema = z.object({
  provider: z.literal('nextdns'),
  name: z.string().min(1).max(255),
  config: z.object({
    profileIds: z.array(z.string()).min(1),
    backfillHours: z.number().int().min(1).max(168).default(24),
  }),
  secret: z.string().min(1),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
