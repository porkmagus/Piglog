import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { app as apiPlugin } from '@piglog/api/app.js';
import {
  workspaceListResponseSchema,
  workspaceResponseSchema,
  sourceListResponseSchema,
  sourceCreateResponseSchema,
  logQueryResponseSchema,
  logIngestResponseSchema,
  integrationListResponseSchema,
  integrationDiscoverResponseSchema,
  integrationTestConnectionResponseSchema,
  alertRuleListResponseSchema,
  alertRuleResponseSchema,
  analyticsOverviewResponseSchema,
  authOkResponseSchema,
  dashboardLayoutResponseSchema,
  dashboardSaveResponseSchema,
  sqlQueryResponseSchema,
  sourcesResponseSchema,
  errorsResponseSchema,
  alertsResponseSchema,
} from './schemas/index.js';

const RUNTIME = Date.now();
const TEST_USER_BASE = `contract${RUNTIME}`;
const TEST_PASSWORD = 'contract-test-password-123';
const TEST_USER_NAME = 'Contract Test';

let server: FastifyInstance;
let baseUrl: string;
let cookies: string;
let workspaceId: string;
let sourceId: string;
let sourceApiKey: string;
let testIndex = 0;

async function api(path: string, options?: RequestInit): Promise<{ status: number; body: unknown }> {
  const method = (options?.method || 'GET').toUpperCase();
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      cookie: cookies,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });
  // Accumulate all Set-Cookie headers (Better Auth sets multiple cookies)
  const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookieHeaders) {
    const nameValue = c.split(';')[0];
    if (!cookies.includes(nameValue.split('=')[0])) {
      cookies += (cookies ? '; ' : '') + nameValue;
    }
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

describe('API contracts', () => {
  beforeAll(async () => {
    server = Fastify();
    await server.register(apiPlugin);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (typeof address === 'object' && address && typeof address.port === 'number') {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error('Failed to get server address');
    }
  }, 30_000);

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    testIndex++;
    const email = `${TEST_USER_BASE}${testIndex}@test.dev`;
    const slug = `contract${RUNTIME}${testIndex}`;
    cookies = '';
    // Sign up
    const signup = await api('/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email, password: TEST_PASSWORD, name: TEST_USER_NAME }),
    });
    expect(signup.status).toBe(200);

    // Sign in
    const signin = await api('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    expect(signin.status).toBe(200);

    // Create workspace
    const ws = await api('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Contract WS', slug }),
    });
    expect(ws.status).toBe(201);
    workspaceId = (ws.body as any).id;

    // Create a source for ingest tests
    const src = await api(`/workspaces/${workspaceId}/sources`, {
      method: 'POST',
      body: JSON.stringify({ name: 'contract-source', type: 'http' }),
    });
    expect(src.status).toBe(201);
    sourceId = (src.body as any).id;
    sourceApiKey = (src.body as any).apiKey;
  });

  describe('workspaces', () => {
    it('GET /workspaces returns valid list', async () => {
      const { status, body } = await api('/workspaces');
      expect(status).toBe(200);
      expect(() => workspaceListResponseSchema.parse(body)).not.toThrow();
    });

    it('PATCH /workspaces/:id returns valid workspace', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated name' }),
      });
      expect(status).toBe(200);
      expect(() => workspaceResponseSchema.parse(body)).not.toThrow();
    });

    it('DELETE /workspaces/:id returns 204', async () => {
      const { status } = await api(`/workspaces/${workspaceId}`, { method: 'DELETE' });
      expect(status).toBe(204);
    });
  });

  describe('sources', () => {
    it('GET /sources returns valid list', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/sources`);
      expect(status).toBe(200);
      expect(() => sourceListResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /sources returns valid source', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/sources`, {
        method: 'POST',
        body: JSON.stringify({ name: 'another-source', type: 'syslog' }),
      });
      expect(status).toBe(201);
      expect(() => sourceCreateResponseSchema.parse(body)).not.toThrow();
    });
  });

  describe('logs', () => {
    it('GET /logs/query returns valid array', async () => {
      const { status, body } = await api(`/logs/query?workspaceId=${workspaceId}&limit=10`);
      expect(status).toBe(200);
      expect(() => logQueryResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /logs/ingest with valid API key returns accepted count', async () => {
      const { status, body } = await api('/logs/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': sourceApiKey },
        body: JSON.stringify({ logs: [{ timestamp: new Date().toISOString(), level: 'INFO', service: 'test', message: 'hello' }] }),
      });
      expect(status).toBe(202);
      expect(() => logIngestResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /logs/ingest without API key returns 401', async () => {
      const { status } = await api('/logs/ingest', {
        method: 'POST',
        body: JSON.stringify({ logs: [{ timestamp: new Date().toISOString(), level: 'INFO', service: 'test', message: 'hello' }] }),
      });
      expect(status).toBe(401);
    });
  });

  describe('integrations', () => {
    it('GET /integrations returns valid list', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/integrations`);
      expect(status).toBe(200);
      expect(() => integrationListResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /integrations/test-connection validates response shape', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/integrations/test-connection`, {
        method: 'POST',
        body: JSON.stringify({ provider: 'nextdns', secret: 'invalid-key' }),
      });
      // Invalid key returns 400 with { error: string }
      expect([200, 400]).toContain(status);
      if (status === 200) {
        expect(() => integrationTestConnectionResponseSchema.parse(body)).not.toThrow();
      }
    });
  });

  describe('alerts', () => {
    it('GET /alerts returns valid list', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/alerts`);
      expect(status).toBe(200);
      expect(() => alertRuleListResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /alerts returns valid rule', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/alerts`, {
        method: 'POST',
        body: JSON.stringify({ name: 'test-alert', service: 'api', operator: 'GREATER_THAN', threshold: 10 }),
      });
      expect(status).toBe(201);
      expect(() => alertRuleResponseSchema.parse(body)).not.toThrow();
    });
  });

  describe('analytics', () => {
    it('GET /analytics/overview returns valid shape', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/analytics/overview`);
      expect(status).toBe(200);
      expect(() => analyticsOverviewResponseSchema.parse(body)).not.toThrow();
    });

    it('GET /analytics/sources returns valid shape', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/analytics/sources`);
      expect(status).toBe(200);
      expect(() => sourcesResponseSchema.parse(body)).not.toThrow();
    });

    it('GET /analytics/errors returns valid shape', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/analytics/errors`);
      expect(status).toBe(200);
      expect(() => errorsResponseSchema.parse(body)).not.toThrow();
    });

    it('GET /analytics/alerts returns valid shape', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/analytics/alerts`);
      expect(status).toBe(200);
      expect(() => alertsResponseSchema.parse(body)).not.toThrow();
    });

    it('POST /analytics/query rejects dangerous keywords', async () => {
      const { status } = await api(`/workspaces/${workspaceId}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify({ sql: 'DROP TABLE log_entry', timeRange: '24h' }),
      });
      expect(status).toBe(400);
    });

    it('POST /analytics/query accepts valid SELECT', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify({ sql: 'SELECT level, count(*) FROM log_entry GROUP BY level', timeRange: '24h' }),
      });
      expect(status).toBe(200);
      expect(() => sqlQueryResponseSchema.parse(body)).not.toThrow();
    });
  });

  describe('dashboard', () => {
    it('GET /dashboard/layout returns valid layout', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/dashboard/layout`);
      expect(status).toBe(200);
      expect(() => dashboardLayoutResponseSchema.parse(body)).not.toThrow();
      expect((body as any).widgets).toBeInstanceOf(Array);
    });

    it('PUT /dashboard/layout saves and returns ok', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/dashboard/layout`, {
        method: 'PUT',
        body: JSON.stringify({ widgets: [], hiddenIds: [] }),
      });
      expect(status).toBe(200);
      expect(() => dashboardSaveResponseSchema.parse(body)).not.toThrow();
    });

    it('DELETE /dashboard/layout removes personal layout', async () => {
      const { status, body } = await api(`/workspaces/${workspaceId}/dashboard/layout`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
      expect(() => dashboardSaveResponseSchema.parse(body)).not.toThrow();
    });
  });
});
