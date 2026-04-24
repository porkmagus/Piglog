# AGENTS.md

This file is for AI and coding agents working in the Piglog repository.

Its job is to make agents productive quickly while keeping the codebase and product direction consistent.

## Purpose

Optimize for a balanced mix of:

- safe, reliable execution
- fast project onboarding
- consistency with active product and architecture decisions

This file is not a human contributor guide. It is an operational and architectural playbook for agents.

## Project Snapshot

Piglog is a workspace-scoped SaaS log aggregation product.

Core shape:

- users sign in to an account
- each user works inside one or more workspaces
- logs, sources, alerts, dashboards, and settings are workspace-scoped
- the backend is Fastify + Drizzle + TimescaleDB + Redis/BullMQ
- the frontend is React Router 7 + Tailwind
- deployment is Docker-based and currently runs on a VPS through Coolify

Current product direction:

- Piglog is a focused logging product, not a giant marketplace of connectors
- ingestion UX is being organized around `Sources` and `Integrations`
- `Sources` are push-style ingestion methods
- `Integrations` are pull-style vendor connections
- integrations should ingest through hidden/internal sources under the hood

## Repo Map

Top-level structure:

- `apps/api`
  - Fastify API server
  - auth, workspace APIs, source APIs, ingestion endpoints
  - background worker entrypoints currently live under `apps/api/src/workers`
- `apps/web`
  - React Router frontend
  - main app shell, dashboard, streams, settings, onboarding
- `packages/db`
  - Drizzle schema
  - raw SQL migrations
  - DB client and migration runner
- `packages/contracts`
  - shared Zod schemas and types
- `ops/docker`
  - local development infrastructure
- `compose.prod.yml`
  - production-oriented multi-service compose definition
- `docs/superpowers/specs`
  - approved product/architecture specs
- `docs/superpowers/plans`
  - implementation plans derived from approved specs

## Architecture Overview

### Ingestion

Today the ingestion pipeline is source-oriented:

- clients or systems send logs to Piglog
- the API validates the source / API key
- logs are inserted into `log_entry`
- Redis is used for live tail fanout
- BullMQ queues are used for downstream work like alerts and webhooks

Important files:

- `apps/api/src/modules/logs/logs.routes.ts`
- `apps/api/src/modules/logs/logs.service.ts`
- `apps/api/src/modules/sources/*`
- `packages/db/src/schema.ts`

### Query / Live Tail / Alerts

- historical queries read from TimescaleDB
- live tail uses Redis pub/sub
- alerts and webhooks run through BullMQ workers

Important files:

- `apps/api/src/modules/logs/logs.live.routes.ts`
- `apps/api/src/queues/index.ts`
- `apps/api/src/workers/alert.worker.ts`
- `apps/api/src/workers/webhook.worker.ts`

### Workspace Boundaries

Workspace scoping is a core design rule.

Agents should preserve these assumptions:

- logs belong to a workspace
- sources belong to a workspace
- integrations should belong to a workspace in v1
- settings and dashboards are workspace-scoped

Do not casually introduce account-level or org-level shared resources unless the task explicitly requires it.

## Development Workflow

Standard local setup:

1. `npm install`
2. `npm run dev:infra`
3. `npm run db:migrate`
4. run app processes:
   - `npm run dev:api`
   - `npm run dev:worker`
   - `npm run dev:web`

Alternative helper:

- `npm run dev`

Useful build commands:

- `npm run build:api`
- `npm run build:web`
- `npm run build:all`

When touching schema or migrations, verify with a fresh bootstrap when practical:

- `npm run db:migrate`

## Deployment Reality

Production deployment is Coolify-based and has some non-obvious constraints that matter.

### API / Worker / Migrations

The API container should not be relied on to run migrations during boot.

Current intended deployment model:

- run migrations separately
- run API container separately
- run worker process separately

Important note:

- migrations should be run with `node packages/db/dist/migrate.js`

Relevant files:

- `apps/api/Dockerfile`
- `compose.prod.yml`
- `README.md`

### Coolify Notes

The repo has already hit real Coolify pitfalls. Agents should remember:

- API port alignment matters
- the API listens on `3001` by default unless `PORT` is explicitly set
- Coolify proxy/health settings must match the actual app port
- database migrations should be verified independently from API container health
- the worker is a real part of the architecture even if Coolify deployment lags behind

## Data And Schema Rules

Schema work must be treated carefully.

Rules:

- keep `packages/db/src/schema.ts` and raw SQL migrations aligned
- do not assume Drizzle schema changes are enough on their own
- do not edit migrations casually without verifying fresh-db behavior
- when changing migrations, verify that a new database can still bootstrap end-to-end

Migration runner:

- `packages/db/src/migrate.ts`

Known history:

- this repo has already had migration failures caused by drift and invalid SQL
- do not “trust that it probably works”

## Frontend And Product Consistency

Piglog should feel focused and intentional, not like a generic admin template.

### Current approved product model

Approved spec:

- `docs/superpowers/specs/2026-04-24-ingestion-integrations-navigation-design.md`

Approved implementation plans:

- `docs/superpowers/plans/2026-04-24-navigation-and-ingestion-ux.md`
- `docs/superpowers/plans/2026-04-24-integrations-foundation-and-nextdns.md`

Active decisions from that spec:

- sidebar remains workspace-focused
- top-level nav is `Dashboard`, `Streams`, `Settings`
- the workspace control should be a real switcher, not fake collapse UI
- bottom-left user area should lead to `Account Settings`
- `Settings` contains `Ingestion`
- `Ingestion` explains the difference between `Sources` and `Integrations`
- `Sources` are push-based
- `Integrations` are pull-based
- `Integrations` should create hidden/internal sources under the hood
- dashboard should expose quick actions like `Add Source` and `Add Integration`
- do not expand a standalone `API Keys` page right now

### UI guidance

When working in the frontend:

- preserve the existing Piglog aesthetic unless a task explicitly redesigns it
- avoid fake affordances
- avoid dead links or placeholder navigation that looks real
- prefer teaching the product model in the UI instead of assuming users know it

## Integration Design Rules

When building integrations, follow a consistent template.

Each integration should remain readable and self-contained.

Recommended per-integration responsibilities:

- config schema
- credential handling
- connection test
- child-entity discovery
- bounded backfill / sync logic
- optional live-stream logic
- normalization into Piglog log events
- health/status reporting

Avoid:

- giant switch statements spread all over the app
- dumping every vendor into one massive UI picker without structure
- bypassing the source/log pipeline with special-case ingestion logic

Preferred model:

- one workspace integration
- one or more discovered child entities
- one hidden/internal source per selected child entity

## Coding Conventions

General expectations:

- prefer small, focused modules
- follow existing file organization unless there is a clear reason to improve it
- avoid large refactors unrelated to the task
- preserve workspace-first boundaries
- keep new abstractions thin and purposeful

For frontend work:

- keep components readable
- avoid misleading interactions
- do not add features that imply a larger system than actually exists

For backend work:

- keep API schemas explicit
- validate external input carefully
- route vendor-specific behavior through well-bounded modules

## Testing And Verification

Do not claim success without verification appropriate to the change.

Minimum expectations:

- frontend changes: `npm run build:web`
- API changes: `npm run build:api`
- cross-app changes: `npm run build:all`
- schema changes: run migrations

When practical:

- verify local dev behavior with the dev stack
- for deployment-related work, keep in mind that local dev and Coolify runtime are not the same

If you cannot run a meaningful verification step, say so explicitly.

## Safety And Repo Hygiene

- `.env.dev` is local-only and should stay out of git
- `.codex` is local-only and should not be committed
- do not commit secrets, tokens, or provider credentials
- be careful when editing Dockerfiles, migrations, or deployment settings because those have already been real failure points

## How To Use The Docs

When a task matches an approved spec or plan:

1. read the relevant spec in `docs/superpowers/specs`
2. read the corresponding implementation plan in `docs/superpowers/plans`
3. keep the work aligned unless the user explicitly changes direction

If the product direction has clearly changed, update the docs before pushing ahead with major implementation.

## Default Agent Posture

When in doubt:

- favor consistency over novelty
- favor explicit product models over clever hidden behavior
- favor workspace-scoped design over broader shared abstractions
- favor verifiable changes over speculative ones

Piglog should stay clean, understandable, and intentionally scoped as it grows.
