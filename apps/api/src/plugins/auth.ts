import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@piglog/db';
import { getAuthSecret, getApiBaseUrl, getTrustedOrigins } from '../lib/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    auth: ReturnType<typeof betterAuth>;
  }
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

function getSocialProviderConfig(clientId?: string, clientSecret?: string) {
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

export function getConfiguredAuthProviders() {
  return {
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  const trustedOrigins = getTrustedOrigins();
  const github = getSocialProviderConfig(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET);
  const google = getSocialProviderConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: getAuthSecret(),
    baseURL: getApiBaseUrl(),
    basePath: '/auth',
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    socialProviders: { github, google },
    session: { expiresIn: 60 * 60 * 24 * 7 },
  });

  fastify.decorate('auth', auth as FastifyInstance['auth']);
});

export async function requireAuth(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!request.user) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }
}
