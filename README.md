# Piglog

Ultra-fast, ultra-clean log aggregation. Grafana capabilities with Linear aesthetics.

## Stack

- **Frontend**: React Router v7, Tailwind CSS, TanStack Query, Recharts
- **Backend**: Fastify 5, Drizzle ORM, Better Auth, BullMQ
- **Database**: TimescaleDB (PostgreSQL time-series extension)
- **Cache/Queue**: Redis
- **Deploy**: Docker Compose on Coolify VPS

## Project Structure

```
piglog/
├── apps/
│   ├── api/           # Fastify backend (port 3001)
│   └── web/           # React Router frontend (port 3000/5173)
├── packages/
│   ├── contracts/     # Shared Zod schemas + types
│   └── db/            # Drizzle schema, migrations, client
├── ops/docker/        # Dev infrastructure compose
├── compose.prod.yml   # Production stack
```

## Getting Started

### 1. Environment

```bash
cp .env.dev.example .env.dev
```

`.env.dev` is gitignored and contains local-only credentials. It's already pre-filled with sensible defaults for localhost development.

### 2. Infrastructure

```bash
npm run dev:infra
```

This starts TimescaleDB (`pg18-oss`) and Redis in Docker with persistent volumes.

### 3. Database Setup

```bash
npm install
npm run db:migrate
```

This runs all `.sql` migrations in order and tracks them in a `_migrations` table.

### 4. Run Dev Servers

You'll need 3 terminal sessions:

```bash
# Terminal 1 - API (port 3001)
npm run dev:api

# Terminal 2 - Background workers (alerts, webhooks)
npm run dev:worker

# Terminal 3 - Web dev server (port 5173)
npm run dev:web
```

The API and workers automatically load `.env.dev` via dotenv. The web app proxies `/api` requests to `localhost:3001` and falls back to the same URL for API calls.

## Architecture

### Ingestion Flow

```
Client → POST /logs/ingest (API Key)
  → Validate source
  → Batch insert into TimescaleDB hypertable
  → Queue alert evaluation (BullMQ)
  → HTTP 202 Accepted
```

### Query Flow

```
Browser → GET /logs/query?workspaceId=...&service=...
  → Auth session check
  → Drizzle query with time-based chunk exclusion
  → Return 500 rows max (virtualized on frontend)
```

### Alerting Flow

```
BullMQ Worker (alert:evaluate)
  → Every minute or per-batch trigger
  → Count logs in time window
  → Compare against alert_rule threshold
  → If triggered: queue webhook notification
```

## TimescaleDB Features Used

- **Hypertables**: `log_entry` partitioned by time
- **Compression**: Enabled after 7 days, segmented by workspace/service/level
- **Retention**: Automatic cleanup after 90 days
- **Chunk Exclusion**: Fast time-range queries

## Production Deploy

```bash
cp .env.example .env.prod
# Fill in production values

docker compose -f compose.prod.yml --env-file .env.prod up -d
```

Services:
- `timescaledb` - Database
- `redis` - Cache & BullMQ broker
- `api` - Fastify HTTP API
- `worker` - BullMQ background workers
- `web` - React Router SSR/static served

## Salvaged from Flowpigdev

This project reuses the following patterns from the original repo:
- Container structure (web + api + db + redis)
- Better Auth integration with workspace multi-tenancy
- Billing/Stripe scaffolding
- Notification engine
- Webhook delivery system with retries
- Docker production setup
- React Router framework mode configuration
- Tailwind + dark theme styling

## License

Private
