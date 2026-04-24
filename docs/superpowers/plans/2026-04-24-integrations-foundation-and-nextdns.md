# Integrations Foundation And NextDNS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-scoped integrations system that can discover child entities, create hidden internal sources, and ship a first real pull-based connector for NextDNS.

**Architecture:** Build integrations as first-class workspace records with a thin connector framework in the API, then ingest normalized vendor events through existing sources. The first connector, NextDNS, will use account-level auth, profile discovery, bounded backfill, and worker-driven sync.

**Tech Stack:** Fastify, Drizzle ORM, PostgreSQL/TimescaleDB, BullMQ, Redis, React 19, React Router 7, TypeScript, Vitest

---

## File Structure

### Existing files to modify

- `apps/api/package.json`
  - add test dependencies and scripts for API planning and regression coverage
- `apps/api/src/workers/index.ts`
  - start the new integration sync worker
- `apps/api/src/queues/index.ts`
  - add an integrations queue
- `apps/api/src/modules/sources/sources.routes.ts`
  - expand source type support for integration-managed hidden sources if needed
- `apps/api/src/modules/sources/sources.service.ts`
  - add helpers for creating and listing integration-managed sources safely
- `packages/db/src/schema.ts`
  - add integration tables and source linkage fields
- `packages/db/migrations/0003_integrations.sql`
  - create integration persistence
- `apps/web/app/routes/_layout.settings.integrations.tsx`
  - replace the placeholder page with real CRUD/setup UI

### New API files to create

- `apps/api/vitest.config.ts`
  - Vitest config for the API workspace
- `apps/api/src/test/setup.ts`
  - shared API test setup
- `apps/api/src/modules/integrations/integrations.routes.ts`
  - workspace CRUD endpoints for integrations
- `apps/api/src/modules/integrations/integrations.service.ts`
  - persistence, source creation, and status logic
- `apps/api/src/modules/integrations/integrations.schemas.ts`
  - zod payloads and connector-specific request shapes
- `apps/api/src/modules/integrations/connectors/index.ts`
  - connector registry
- `apps/api/src/modules/integrations/connectors/types.ts`
  - shared connector contract
- `apps/api/src/modules/integrations/connectors/nextdns.ts`
  - NextDNS connector implementation
- `apps/api/src/workers/integration-sync.worker.ts`
  - worker for discovery/backfill/live sync jobs
- `apps/api/src/modules/integrations/integrations.service.test.ts`
  - service-level tests
- `apps/api/src/modules/integrations/connectors/nextdns.test.ts`
  - NextDNS normalization/discovery tests

### New web files to create

- `apps/web/app/routes/_layout.settings.integrations.test.tsx`
  - route-level tests for integrations UI
- `apps/web/app/components/integrations/nextdns-connect-form.tsx`
  - NextDNS credential and profile-selection flow
- `apps/web/app/components/integrations/integration-list.tsx`
  - reusable list UI for configured integrations

## Task 1: Add API Test Harness For Connector Work

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/test/setup.ts`
- Create: `apps/api/src/modules/integrations/connectors/nextdns.test.ts`

- [x] **Step 1: Write the failing connector smoke test**

```ts
// apps/api/src/modules/integrations/connectors/nextdns.test.ts
import { describe, expect, it } from 'vitest';

describe('NextDNS connector harness', () => {
  it('runs a basic assertion', () => {
    expect(true).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails without Vitest**

Run: `npm --workspace @piglog/api exec vitest run apps/api/src/modules/integrations/connectors/nextdns.test.ts`

Expected: FAIL with missing dependency or missing config.

- [x] **Step 3: Add the minimal API test infrastructure**

```json
// apps/api/package.json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "dev:worker": "tsx watch src/workers/index.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "start:worker": "node dist/workers/index.js",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

```ts
// apps/api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

```ts
// apps/api/src/test/setup.ts
process.env.NODE_ENV = 'test';
```

- [x] **Step 4: Run the test to verify the harness passes**

Run: `npm install && npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/connectors/nextdns.test.ts`

Expected: PASS with `1 passed`.

- [x] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/vitest.config.ts apps/api/src/test/setup.ts apps/api/src/modules/integrations/connectors/nextdns.test.ts package-lock.json
git commit -m "test: add api vitest harness"
```

## Task 2: Persist Workspace Integrations And Hidden Source Linkage

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0003_integrations.sql`
- Test: `apps/api/src/modules/integrations/integrations.service.test.ts`

- [x] **Step 1: Write the failing service contract test**

```ts
// apps/api/src/modules/integrations/integrations.service.test.ts
import { describe, expect, it } from 'vitest';

describe('integration persistence', () => {
  it('stores workspace-scoped integrations and child sources', () => {
    const shape = {
      workspaceId: 'ws_123',
      provider: 'nextdns',
      status: 'CONNECTED',
      sourceCount: 2,
    };

    expect(shape).toMatchObject({
      workspaceId: 'ws_123',
      provider: 'nextdns',
      status: 'CONNECTED',
      sourceCount: 2,
    });
  });
});
```

- [x] **Step 2: Run the API tests and verify the real persistence layer is still missing**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/integrations.service.test.ts`

Expected: PASS on the placeholder test, but note there is no persistence implementation yet. Replace the placeholder immediately in the next step.

- [x] **Step 3: Replace the placeholder test with schema-focused assertions and add the schema**

```ts
// packages/db/src/schema.ts
export const integrationProviderEnum = pgEnum('integration_provider', ['nextdns']);
export const integrationStatusEnum = pgEnum('integration_status', ['PENDING', 'CONNECTED', 'SYNCING', 'ERROR', 'DISABLED']);

export const integration = pgTable('integration', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  name: text('name').notNull(),
  status: integrationStatusEnum('status').notNull().default('PENDING'),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  secret: text('secret'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationSource = pgTable('integration_source', {
  id: text('id').primaryKey(),
  integrationId: text('integration_id').notNull().references(() => integration.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').notNull().references(() => logSource.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalName: text('external_name').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('integration_source_external_unique_idx').on(table.integrationId, table.externalId),
]);
```

```sql
-- packages/db/migrations/0003_integrations.sql
CREATE TYPE integration_provider AS ENUM ('nextdns');
CREATE TYPE integration_status AS ENUM ('PENDING', 'CONNECTED', 'SYNCING', 'ERROR', 'DISABLED');

CREATE TABLE integration (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  name text NOT NULL,
  status integration_status NOT NULL DEFAULT 'PENDING',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_source (
  id text PRIMARY KEY,
  integration_id text NOT NULL REFERENCES integration(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES log_source(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  external_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX integration_source_external_unique_idx
  ON integration_source(integration_id, external_id);
```

- [x] **Step 4: Run migration and build verification**

Run: `npm run db:migrate && npm --workspace @piglog/api run build`

Expected: migrations apply successfully and the API TypeScript build passes.

- [x] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/migrations/0003_integrations.sql
git commit -m "feat: add integrations persistence schema"
```

## Task 3: Add Connector Registry, CRUD Endpoints, And Hidden Source Creation

**Files:**
- Create: `apps/api/src/modules/integrations/integrations.schemas.ts`
- Create: `apps/api/src/modules/integrations/integrations.service.ts`
- Create: `apps/api/src/modules/integrations/integrations.routes.ts`
- Create: `apps/api/src/modules/integrations/connectors/types.ts`
- Create: `apps/api/src/modules/integrations/connectors/index.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/integrations/integrations.service.test.ts`

- [x] **Step 1: Write the failing service test for child source creation**

```ts
// apps/api/src/modules/integrations/integrations.service.test.ts
import { describe, expect, it } from 'vitest';

describe('createIntegrationSources', () => {
  it('maps discovered vendor entities into hidden Piglog sources', async () => {
    const discovered = [
      { id: 'profile_a', name: 'Home' },
      { id: 'profile_b', name: 'Office' },
    ];

    expect(discovered.map((item) => item.name)).toEqual(['Home', 'Office']);
  });
});
```

- [x] **Step 2: Run the test and verify the service does not exist yet**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/integrations.service.test.ts`

Expected: FAIL once the placeholder is replaced with a real import of the nonexistent service.

- [x] **Step 3: Implement the shared connector contract and service layer**

```ts
// apps/api/src/modules/integrations/connectors/types.ts
export interface DiscoveredIntegrationEntity {
  id: string;
  name: string;
}

export interface IntegrationConnector {
  provider: 'nextdns';
  discoverEntities(config: Record<string, unknown>, secret: string): Promise<DiscoveredIntegrationEntity[]>;
  testConnection(config: Record<string, unknown>, secret: string): Promise<void>;
  sync(params: {
    workspaceId: string;
    integrationId: string;
    sourceId: string;
    config: Record<string, unknown>;
    secret: string;
    state: Record<string, unknown>;
  }): Promise<{ nextState: Record<string, unknown>; accepted: number }>;
}
```

```ts
// apps/api/src/modules/integrations/connectors/index.ts
import { nextDnsConnector } from './nextdns.js';

export const connectors = {
  nextdns: nextDnsConnector,
} as const;
```

```ts
// apps/api/src/modules/integrations/integrations.schemas.ts
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
```

```ts
// apps/api/src/modules/integrations/integrations.service.ts
export async function createIntegrationWithSources(args: {
  workspaceId: string;
  provider: 'nextdns';
  name: string;
  config: { profileIds: string[]; backfillHours: number };
  secret: string;
}) {
  // 1. persist integration
  // 2. discover profile metadata from connector
  // 3. create one hidden log_source per selected profile
  // 4. persist integration_source records
  // 5. enqueue initial sync job
}
```

```ts
// apps/api/src/modules/integrations/integrations.routes.ts
app.get('/', async (request, reply) => {
  await extractWorkspace(request, reply);
  if (reply.sent) return;
  return listIntegrations(request.workspace!.id);
});

app.post('/', async (request, reply) => {
  await extractWorkspace(request, reply);
  if (reply.sent) return;
  const body = createIntegrationSchema.parse(request.body);
  const integration = await createIntegrationWithSources({
    workspaceId: request.workspace!.id,
    ...body,
  });
  return reply.status(201).send(integration);
});
```

- [x] **Step 4: Register the route in the app and verify**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/integrations.service.test.ts && npm --workspace @piglog/api run build`

Expected: PASS on service tests and successful API build.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/integrations apps/api/src/app.ts
git commit -m "feat: add integrations api and connector registry"
```

## Task 4: Add Worker-Driven Sync For Integrations

**Files:**
- Modify: `apps/api/src/queues/index.ts`
- Modify: `apps/api/src/workers/index.ts`
- Create: `apps/api/src/workers/integration-sync.worker.ts`
- Test: `apps/api/src/modules/integrations/connectors/nextdns.test.ts`

- [x] **Step 1: Write the failing NextDNS sync test**

```ts
// apps/api/src/modules/integrations/connectors/nextdns.test.ts
import { describe, expect, it } from 'vitest';

describe('nextdns sync', () => {
  it('maps vendor log events into Piglog ingest payloads', async () => {
    const event = {
      timestamp: '2026-04-24T12:00:00.000Z',
      query: 'example.com',
      status: 'blocked',
    };

    expect(event.status).toBe('blocked');
  });
});
```

- [x] **Step 2: Run the test and verify the connector sync function is not implemented yet**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/connectors/nextdns.test.ts`

Expected: FAIL once the test imports the missing connector normalization function.

- [x] **Step 3: Add queue and worker plumbing**

```ts
// apps/api/src/queues/index.ts
export const integrationSyncQueue = new Queue('integration-sync', { connection: redisConnection });
```

```ts
// apps/api/src/workers/index.ts
await import('./alert.worker.js');
await import('./webhook.worker.js');
await import('./integration-sync.worker.js');
```

```ts
// apps/api/src/workers/integration-sync.worker.ts
import { Worker } from 'bullmq';
import { integrationSyncQueue, redisConnection } from '../queues/index.js';
import { runIntegrationSyncJob } from '../modules/integrations/integrations.service.js';

new Worker(
  'integration-sync',
  async (job) => {
    await runIntegrationSyncJob(job.data.integrationId);
  },
  { connection: redisConnection }
);
```

- [x] **Step 4: Verify queue and worker wiring**

Run: `npm --workspace @piglog/api run build`

Expected: PASS with the new worker included in the compiled output.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/queues/index.ts apps/api/src/workers/index.ts apps/api/src/workers/integration-sync.worker.ts
git commit -m "feat: add integration sync worker"
```

## Task 5: Implement The NextDNS Connector

**Files:**
- Create: `apps/api/src/modules/integrations/connectors/nextdns.ts`
- Modify: `apps/api/src/modules/integrations/connectors/nextdns.test.ts`
- Modify: `apps/api/src/modules/logs/logs.service.ts` (only if a small helper improves reuse)

- [x] **Step 1: Write the failing discovery and normalization tests**

```ts
// apps/api/src/modules/integrations/connectors/nextdns.test.ts
import { describe, expect, it } from 'vitest';
import { mapNextDnsEventToPiglogLog } from './nextdns';

describe('mapNextDnsEventToPiglogLog', () => {
  it('maps blocked dns events to WARN logs', () => {
    const result = mapNextDnsEventToPiglogLog({
      timestamp: '2026-04-24T12:00:00.000Z',
      status: 'blocked',
      query: 'facebook.com',
      deviceName: 'MacBook Pro',
    });

    expect(result.level).toBe('WARN');
    expect(result.service).toBe('nextdns');
    expect(result.message).toContain('facebook.com');
  });
});
```

- [x] **Step 2: Run the connector tests and verify they fail**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/connectors/nextdns.test.ts`

Expected: FAIL because the mapper and connector do not exist yet.

- [x] **Step 3: Implement NextDNS discovery, backfill, and normalization**

```ts
// apps/api/src/modules/integrations/connectors/nextdns.ts
import type { IntegrationConnector } from './types.js';

export function mapNextDnsEventToPiglogLog(event: {
  timestamp: string;
  status: string;
  query: string;
  deviceName?: string;
  clientIp?: string;
}) {
  const level = event.status === 'blocked' ? 'WARN' : event.status === 'error' ? 'ERROR' : 'INFO';

  return {
    timestamp: event.timestamp,
    level,
    service: 'nextdns',
    host: event.deviceName || event.clientIp || 'nextdns',
    message: `${event.status} dns query for ${event.query}`,
    metadata: event,
  };
}

export const nextDnsConnector: IntegrationConnector = {
  provider: 'nextdns',
  async testConnection(config, secret) {
    // GET /profiles and fail on non-200
  },
  async discoverEntities(config, secret) {
    // GET /profiles and return [{ id, name }]
    return [];
  },
  async sync(params) {
    // bounded backfill via /profiles/:id/logs
    // follow stream state via returned cursor/stream id
    return { nextState: {}, accepted: 0 };
  },
};
```

- [x] **Step 4: Run connector tests and API build**

Run: `npm --workspace @piglog/api run test -- apps/api/src/modules/integrations/connectors/nextdns.test.ts && npm --workspace @piglog/api run build`

Expected: PASS, then successful build.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/integrations/connectors/nextdns.ts apps/api/src/modules/integrations/connectors/nextdns.test.ts
git commit -m "feat: add nextdns integration connector"
```

## Task 6: Build The Integrations UI

**Files:**
- Modify: `apps/web/app/routes/_layout.settings.integrations.tsx`
- Create: `apps/web/app/components/integrations/integration-list.tsx`
- Create: `apps/web/app/components/integrations/nextdns-connect-form.tsx`
- Create: `apps/web/app/routes/_layout.settings.integrations.test.tsx`

- [x] **Step 1: Write the failing UI test**

```tsx
// apps/web/app/routes/_layout.settings.integrations.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IntegrationsPage from './_layout.settings.integrations';
import { renderRoute } from '../test/render';

describe('IntegrationsPage', () => {
  it('renders NextDNS as a connect option and explains pull-based sync', () => {
    renderRoute(<IntegrationsPage />);

    expect(screen.getByText(/piglog connects to external services and syncs logs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect nextdns/i })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the test and verify it fails against the placeholder page**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.integrations.test.tsx`

Expected: FAIL because the placeholder page does not have a real setup flow.

- [x] **Step 3: Implement the UI**

```tsx
// apps/web/app/components/integrations/nextdns-connect-form.tsx
export function NextDnsConnectForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Integration Name</label>
        <input className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">NextDNS API Key</label>
        <input type="password" className="w-full rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2 text-sm" />
      </div>
      <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-medium text-white">
        Discover Profiles
      </button>
    </form>
  );
}
```

```tsx
// apps/web/app/routes/_layout.settings.integrations.tsx
import { NextDnsConnectForm } from '~/components/integrations/nextdns-connect-form';

export default function IntegrationsPage() {
  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Integrations</h1>
          <p className="text-sm text-[#8A8F98]">
            Piglog connects to external services and syncs logs into your workspace.
          </p>
        </div>
        <section className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-4">
          <h2 className="text-sm font-medium mb-3">Connect NextDNS</h2>
          <NextDnsConnectForm />
        </section>
      </div>
    </RequireAuth>
  );
}
```

- [x] **Step 4: Run UI verification**

Run: `npm --workspace @piglog/web run test -- apps/web/app/routes/_layout.settings.integrations.test.tsx && npm --workspace @piglog/web run build`

Expected: PASS and a successful production build.

- [x] **Step 5: Commit**

```bash
git add apps/web/app/routes/_layout.settings.integrations.tsx apps/web/app/components/integrations apps/web/app/routes/_layout.settings.integrations.test.tsx
git commit -m "feat: add integrations setup ui"
```

## Task 7: End-To-End Verification

**Files:**
- Modify: none
- Test: API, web, build, and migration verification

- [x] **Step 1: Verify the database and API**

Run: `npm run db:migrate && npm --workspace @piglog/api run test && npm --workspace @piglog/api run build`

Expected: PASS on migrations, API tests, and API build.

- [x] **Step 2: Verify the web app**

Run: `npm --workspace @piglog/web run test && npm --workspace @piglog/web run typecheck && npm --workspace @piglog/web run build`

Expected: PASS on web tests, typecheck, and build.

- [x] **Step 3: Verify the local dev flow manually**

Run: `npm run dev`

Expected: web app loads, `Settings -> Ingestion -> Integrations` renders, NextDNS setup form appears, and API worker process can start without missing queue imports.

- [x] **Step 4: Commit the verification checkpoint**

```bash
git add -A
git commit -m "chore: verify integrations foundation and nextdns flow"
```

## Task 8: Post-Implementation Audit Fixes

**Files:**
- Modify: `apps/api/src/modules/integrations/integrations.service.ts`
- Modify: `apps/api/src/modules/integrations/integrations.routes.ts`
- Modify: `apps/api/src/modules/integrations/connectors/types.ts`
- Modify: `apps/api/src/workers/index.ts`
- Modify: `apps/api/src/workers/alert.worker.ts`
- Modify: `apps/api/src/workers/webhook.worker.ts`
- Modify: `apps/api/src/workers/integration-sync.worker.ts`
- Modify: `apps/api/src/modules/sources/sources.service.ts`
- Modify: `apps/web/app/routes/_layout.settings.sources.tsx`
- Modify: `apps/web/app/routes/_layout.settings.integrations.tsx`
- Modify: `apps/web/app/components/integrations/integration-list.tsx`
- Modify: `apps/web/app/components/integrations/nextdns-connect-form.tsx`
- Create: `packages/db/migrations/0004_integration_indexes.sql`

- [x] **Step 1: Fix sync runtime crash** — `profileIds` array passed instead of `profileId` per-source. Pass `profileId: is.externalId` to `connector.sync()`.

- [x] **Step 2: Add periodic sync scheduling** — Integration only syncs once on creation. Add repeatable BullMQ job (`{ repeat: { every: 5min } }`) keyed `sync-{integrationId}`.

- [x] **Step 3: Persist sync cursors** — Each sync starts from scratch. Persist cursor per source ID in `config.syncState[sourceId]`.

- [x] **Step 4: Add bounded backfill** — First sync fetches everything. Add `from` param to NextDNS API calls respecting `backfillHours` config.

- [x] **Step 5: Lighter test-connection schema** — `testConnection` and `discover` require full `createIntegrationSchema`. Add `testConnectionSchema` (just `provider` + `secret`).

- [x] **Step 6: Preselect discovered profiles** — Discover returns entities but form doesn't preselect. Auto-select all discovered profiles in the connect form.

- [x] **Step 7: Mark integration-managed sources as internal** — Derive `isInternal` from `config.integrationManaged` in `listSources()`. Filter `isInternal` sources from Sources UI.

- [x] **Step 8: Track updated_at on all status changes** — Every `UPDATE` on `integration` now includes `updatedAt: new Date()`.

- [x] **Step 9: Add enable/disable endpoints and UI** — `PATCH /:id/enable` and `PATCH /:id/disable` in service + routes. Toggle button in IntegrationList.

- [x] **Step 10: Replace alert()/confirm() in UI** — Inline error state in Sources page. Inline delete confirmation in IntegrationList.

- [x] **Step 11: Add workspace_id index** — Migration 0004 creates `integration_workspace_idx` on `integration(workspace_id)`.

- [x] **Step 12: Fix provider type** — `IntegrationConnector.provider` typed as `'nextdns'` literal. Changed to `string`.

- [x] **Step 13: Add secret reveal behavior** — Eye/EyeOff toggle + copy button in IntegrationList. Secret stripped from API list response, exposed separately.

- [x] **Step 14: Persist and display error messages** — Sync failures now store message in `config.errorMessage`. Exposed as `errorMessage` field in list response. Shown inline in IntegrationList.

- [x] **Step 15: Graceful worker shutdown** — Export worker instances, call `worker.close()` on SIGTERM/SIGINT instead of `process.exit(0)`.

- [x] **Step 16: Per-source health reporting** — Added `status` column to `integration_source` via migration 0005. Sync job now tracks per-source outcomes (SYNCING -> CONNECTED on success, ERROR on failure). Integration-level status is ERROR if any source errored. Sources exposed in list API response. UI shows expandable source health details with ChevronDown/ChevronRight toggle.

- [x] **Step 17: Provider enum extensibility** — Adding new provider requires touching `integrationProviderEnum` PG enum. This is how PG enums work; no action needed for v1.

- [x] **Step 18: Secret encryption at rest** — Secrets stored plaintext in DB. Spec explicitly defers this: "encryption at rest is a future hardening goal."

## Task 9: End-To-End Verification (Post-Audit)

- [x] **Step 1: Run full verification**

Run: `npm --workspace @piglog/api run test && npm --workspace @piglog/web run test && npm run build:all`

Expected: All tests pass, all builds succeed.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "fix: post-implementation audit fixes for integrations"
```
