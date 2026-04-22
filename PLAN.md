# Piglog Masterplan — Locked

> **Current Status:** Foundation scaffolded
> **Target Domain:** piglog.dev
> **Audience:** Solo devs, tech hackers, network engineers
> **MVP Scope:** Phase 1 complete — substantial, polished, free. No billing.
> **Design:** Strict Linear-inspired. Minimal chrome, keyboard-first, zero loading states.

---

## Phase 0: Foundation ✅

**Completed:**
- Monorepo structure (`apps/api`, `apps/web`, `packages/db`, `packages/contracts`)
- TimescaleDB hypertable schema with compression + retention
- Better Auth (Drizzle adapter) + workspace multi-tenancy
- Fastify API with log ingestion (`POST /logs/ingest`) and query (`GET /logs/query`)
- BullMQ worker scaffold (`alert:evaluate` queue)
- React Router 7 web shell with Linear-style dark UI
- Docker Compose production stack (timescaledb + redis + api + worker + web)
- All dependencies pinned to latest stable versions

---

## Phase 1: MVP — "A Stable, Polished Product"

**Target:** A developer signs up, creates a workspace, configures a source (HTTP, syslog, or file upload), ships logs, and views them in a fast, clean interface with live tail, search, dashboard, and alerting. Free for all users. No billing gate.

### 1.1 Log Sources & Ingestion
- [ ] **HTTP JSON API** — Batch ingest with API key auth *(exists, needs hardening)*
- [ ] **Syslog UDP/TCP listener** — Raw syslog parser for network gear (Unifi, etc.)
- [ ] **File upload** — Drag/drop `.log`, `.jsonl`, `.csv` historical import
- [ ] **Source management UI** — Create/delete sources, copy curl/syslog config, see volume stats
- [ ] **Rate limiting** — Per-source + per-workspace limits via Redis
- [ ] **Ingestion examples** — Copy-paste snippets for Docker, Vector, Fluent Bit, syslog, curl

### 1.2 Log Viewer (The Core Screen)
- [ ] **Virtualized table** — `@tanstack/react-virtual`, 60fps at 100k+ rows
- [ ] **Column layout** — Timestamp | Level badge | Service | Host | Message
- [ ] **Inline expansion** — Click/Enter to expand row → JSON metadata + trace linking
- [ ] **Live tail toggle** — SSE connection, auto-scroll, pause on interaction
- [ ] **Color-coded levels** — Error=red, Warn=yellow, Info=blue, Debug=gray
- [ ] **Keyboard navigation** — `j/k` row nav, `Enter` expand, `Esc` collapse, `t` toggle live, `/` focus search
- [ ] **Copy raw log** — `Cmd+C` on selected row copies JSON

### 1.3 Search & Filtering
- [ ] **Token-based query bar** — `service:api level:error host:prod-1 searchTerm`
- [ ] **Time range picker** — Last 15m / 1h / 24h / 7d / custom
- [ ] **CMD+K command palette** — Jump to streams, recent searches, settings, keyboard shortcuts
- [ ] **Instant feedback** — 0ms token parsing, 50ms text debounce
- [ ] **URL-synced state** — Filters are shareable via URL

### 1.4 Dashboard
- [ ] **Log volume sparkline** — Logs/minute over selected time range (Recharts, Canvas)
- [ ] **Level breakdown** — Bar chart of error/warn/info/debug counts
- [ ] **Top services table** — Noisiest services + their error rates
- [ ] **Top hosts table** — For network engineers tracking device health
- [ ] **All charts hit `logs_1min_agg`** — TimescaleDB continuous aggregate

### 1.5 Alerting (MVP)
- [ ] **Alert rule builder** — Threshold + time window + service/level/host filters
- [ ] **Notification channels** — Webhook URL only for MVP (Slack/Discord later)
- [ ] **Alert history** — Fired / resolved list
- [ ] **Mute/pause rules** — Temporary disable without deleting
- [ ] **In-app notifications** — Toast on alert fire

### 1.6 Workspace & Auth Polish
- [ ] **Onboarding flow** — Sign up → create workspace → create source → copy config → see first log
- [ ] **Workspace settings** — Name, slug, delete workspace
- [ ] **Member invitation** — Email invite link (reuse existing `invitation` table)
- [ ] **API key regeneration** — Rotate source keys without losing history

### 1.7 Infrastructure Hardening
- [ ] **TimescaleDB continuous aggregates** — `logs_1min_agg` for instant charts
- [ ] **BullMQ reliability** — Retry with backoff, dead letter queue
- [ ] **API rate limiting** — `@fastify/rate-limit` with Redis store
- [ ] **Health checks** — DB, Redis, queue depth, ingestion lag
- [ ] **Log retention enforcement** — 90d automatic cleanup

---

## Phase 2: Post-MVP — "This Feels Like a Business"

### 2.1 Billing & Plans
- [ ] **Stripe integration** — Reuse flowpigdev billing scaffold
- [ ] **Plans:** Free (3 sources, 7d retention), Pro (unlimited sources, 30d), Team (unlimited, 90d, SSO)
- [ ] **Usage metering** — Log volume per workspace
- [ ] **Self-serve upgrade**

### 2.2 Advanced Alerting
- [ ] **Notification channels** — Slack, Discord, PagerDuty, Email
- [ ] **Alert deduplication** — Group by trace_id or fingerprint
- [ ] **Alert templates** — Custom webhook payloads

### 2.3 Saved Views & Collaboration
- [ ] **Saved queries** — Name + share filter combos
- [ ] **Dashboard builder** — Drag blocks (chart, table, stat) onto canvas
- [ ] **Comments on logs** — Team annotations

### 2.4 Scale & Integrations
- [ ] **Vector sink** — Native Vector configuration
- [ ] **Kubernetes** — Helm chart + DaemonSet
- [ ] **OTLP/gRPC** — OpenTelemetry compatibility
- [ ] **Export** — CSV/JSON download (queued via BullMQ)
- [ ] **Full-text search** — Meilisearch or pg_trgm for message search

### 2.5 AI Features (Post-MVP)
- [ ] **Natural language query** — "Show me all payment failures yesterday"
- [ ] **Anomaly detection** — Auto-detect error spikes
- [ ] **Log summarization** — "What happened in the last hour?"

### 2.6 Final Polish
- [ ] **PWA** — Offline cached logs, installable
- [ ] **Mobile responsiveness** — Collapsible sidebar, touch rows
- [ ] **Keyboard shortcuts modal** — `?` to show all shortcuts
- [ ] **Prefetch everywhere** — React Router `prefetch="intent"`
- [ ] **Optimistic UI** — Instant feedback on all mutations

---

## Decisions Log

| Question | Decision |
|----------|----------|
| **Audience** | Solo devs, hackers, network engineers. Supports app logs + network logs (Unifi, etc.) |
| **MVP Scope** | Phase 1 complete. Substantial, polished, free. No billing. |
| **Billing** | Post-MVP. Free first, monetize later. |
| **Live Tail** | In MVP. SSE-based real-time streaming. |
| **AI** | Post-MVP only. |
| **Ingestion** | HTTP JSON + Syslog UDP/TCP + File upload (not just HTTP). |
| **Alerting** | In MVP. Threshold rules + webhook notifications only. |
| **Design** | Strict Linear-inspired. Minimal chrome, keyboard-first, no loading spinners. |

---

## Execution Order

We build in this order to maximize "feels like a product" at each step:

1. **Source Management + Multi-Protocol Ingestion** — HTTP hardening + Syslog listener + File upload. Without data, the UI is just a shell.
2. **Virtualized Log Table** — The "one really good screen" that sells the product.
3. **Live Tail SSE** — Makes it feel alive and real-time.
4. **Token Search + CMD+K** — The Linear differentiator.
5. **Dashboard** — Charts give users a reason to return.
6. **Alerting** — Threshold rules + webhook delivery.
7. **Onboarding + Polish** — Onboarding flow, settings, keyboard shortcuts, URL-synced filters.
8. **TimescaleDB Continuous Aggregates** — Optimize chart queries.

---

*Plan locked. Ready to execute.*
