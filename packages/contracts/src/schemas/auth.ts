import { z } from 'zod';

export const authOkResponseSchema = z.object({
  ok: z.boolean(),
});

export type AuthOkResponse = z.infer<typeof authOkResponseSchema>;
