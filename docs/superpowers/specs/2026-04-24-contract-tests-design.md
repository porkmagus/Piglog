# Contract Tests — API Response Shape Verification

## Problem

The frontend and backend drift apart silently. A field gets renamed on the API, a new required field is added, or a response shape changes — and nothing breaks until someone clicks through the affected flow in production. Unit tests mock responses, so they pass against stale shapes. E2E tests are slow and brittle, and they only cover happy paths.

Contract tests sit between unit and E2E: they start the real API, hit every endpoint, and validate responses against Zod schemas. If a field changes, the contract test fails immediately.

## Design

### Response Schemas

Each API module gets a corresponding response schema file in `packages/contracts/src/schemas/`:

| File | Endpoint | Schema |
|------|----------|--------|
| `workspaces.ts` | `GET /workspaces` | `z.array(z.object({ id, name, slug, role }))` |
| | `POST /workspaces` | `z.object({ id, name, slug, ownerId, inviteCode, createdAt, updatedAt })` |
| | `PATCH /workspaces/:id` | same as create |
| | `DELETE /workspaces/:id` | `z.null()` (204) |
| | `GET /workspaces/:id/members` | `z.array(z.object({ id, userId, name?, email?, role, joinedAt }))` |
| | `POST /workspaces/:id/invitations` | `z.object({ id, email, role, status, token, expiresAt })` |
| | `GET /workspaces/:id/invitations` | `z.array(z.object({ id, email, role, status, invitedBy, expiresAt }))` |
| `sources.ts` | `GET /sources` | `z.array(z.object({ id, name, type, apiKey, createdAt, volume24h, lastSeen?, isInternal }))` |
| | `POST /sources` | `z.object({ id, name, type, apiKey, workspaceId, createdAt })` |
| | `POST /sources/:id/regenerate-key` | `z.object({ id, apiKey })` |
| `logs.ts` | `GET /logs/query` | `z.array(z.object({ id, timestamp, level, service, host?, message, metadata?, traceId?, sourceId, workspaceId }))` |
| | `POST /logs/ingest` | `z.object({ accepted: z.number() })` |
| `integrations.ts` | `GET /integrations` | `z.array(z.object({ id, provider, name, status, config, errorMessage?, lastSyncedAt?, createdAt, sources }))` |
| | `POST /integrations` | `z.object({ id, provider, name, status, workspaceId, createdAt })` |
| | `POST /integrations/discover` | `z.object({ entities: z.array(z.object({ id, name })) })` |
| | `POST /integrations/test-connection` | `z.object({ ok: z.boolean() })` |
| `alerts.ts` | `GET /alerts` | `z.array(z.object({ id, name, description?, service, level?, operator, threshold, windowMinutes, status, webhookUrl?, lastTriggeredAt?, createdAt }))` |
| | `POST /alerts` | `z.object({ id, name, service, operator, threshold, windowMinutes, status, createdAt })` |
| | `PATCH /alerts/:id` | same as create |
| | `GET /alerts/events` | `z.array(z.object({ id, alertRuleId, actualCount, threshold, operator, status, createdAt, rule? }))` |
| `analytics.ts` | `GET /analytics/overview` | `z.object({ volume, levels, services, hosts, total24h })` |
| `auth.ts` | `POST /auth/change-password` | `z.object({ ok: z.boolean() })` |
| | `POST /auth/change-email` | `z.object({ ok: z.boolean() })` |

Each schema exports both the Zod runtime schema and a TypeScript type inferred from it. This ensures the schema and type can never drift.

### Contract Test Runner

A single test file (`packages/contracts/src/contract.test.ts`) that:

1. Imports the API's Fastify app factory (`apps/api/src/app.ts`)
2. Starts a listening server on a random port, connected to the dev database (same `.env.dev` as unit tests)
3. Iterates over every endpoint, sends a real request via `fetch`, validates the response body against the corresponding schema
4. Shuts down the server

**Infrastructure requirement:** The dev stack must be running (`npm run dev:infra`). Same requirement as existing API unit tests. The test connects to local PostgreSQL + TimescaleDB + Redis via `.env.dev`.

### Test Data Setup

Each test group seeds its own data before making requests:
- Create a test user via Better Auth signup
- Capture the session cookie
- Create a test workspace
- Use that workspace for all workspace-scoped endpoints

Cleanup runs in `afterEach` to keep tests isolated.

### Error Response Validation

Contract tests also validate error responses. For each endpoint:
- Send a request with invalid input → verify 400 with `{ error: string }`
- Send a request with bad credentials → verify 401
- Send a request for non-existent resource → verify 404

This ensures error handling is consistent across all routes.

### Frontend Integration

Frontend components import response types from contracts:
```ts
import type { WorkspaceListResponse } from '@piglog/contracts';

const data = (await fetchApi('/workspaces')) as WorkspaceListResponse;
```

If a schema changes (field removed, renamed, type changed), TypeScript catches the mismatch at compile time. The contract test catches it at runtime.

## What This Catches

1. **Renamed fields** — schema validation fails on mismatched keys
2. **Missing fields** — required fields that the API stopped returning
3. **Type changes** — number → string, string → null, etc.
4. **New required fields** — frontend breaks if it expects a field the API doesn't send
5. **Inconsistent error shapes** — some routes return `{ error }`, others return different structures
6. **Nested shape drift** — sources inside integrations response, rule inside alert event

## What This Doesn't Cover

- **Business logic correctness** — contract tests verify shape, not whether the data is right. That's unit/E2E territory.
- **Performance** — no timing assertions.
- **Authentication flow** — Better Auth handles this; we test our custom routes.

## Running

```bash
npm run test:contract    # runs contract.test.ts against dev DB
```

Added to CI. Blocks merge on failure.

## Scope

- Phase 1: Response schemas for all existing endpoints + contract test runner
- Phase 2: Error response validation
- Phase 3: Frontend types imported from contracts (ongoing, per-feature)
