import { z } from 'zod';

export const workspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string(),
  inviteCode: z.string(),
  ownerId: z.string(),
  plan: z.string(),
  settings: z.unknown(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export const workspaceListResponseSchema = z.array(
  workspaceResponseSchema.extend({
    role: z.string(),
  })
);

export const workspaceMemberResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  role: z.string(),
  joinedAt: z.string(),
});

export const workspaceMemberListResponseSchema = z.array(workspaceMemberResponseSchema);

export const invitationResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  invitedBy: z.unknown(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const invitationListResponseSchema = z.array(invitationResponseSchema);

export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;
export type WorkspaceMemberResponse = z.infer<typeof workspaceMemberResponseSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
