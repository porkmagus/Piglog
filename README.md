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
cp .env.example .env.dev
```

### 2. Infrastructure

```bash
npm run dev:infra
```

This starts TimescaleDB and Redis in Docker.

### 3. Database Setup

```bash
npm install
npm run db:migrate
```

### 4. Run Dev Servers

```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Worker
npm run dev:worker

# Terminal 3 - Web
npm run dev:web
```

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
