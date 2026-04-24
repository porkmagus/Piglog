# Customizable Dashboard Design

## Date
2026-04-24

## Status
Approved

## Problem

Current dashboard has 4 static widgets (volume, levels, services, hosts) that are always shown. Users cannot customize what they see, reorder widgets, or create custom views. Charts lack context — tooltips show raw data without labels explaining what the numbers mean.

## Goals

1. Users can customize which widgets appear on their dashboard
2. Users can reorder and resize widgets in a grid
3. Users can create custom SQL widgets with full chart configuration
4. Charts have clear labels, tooltips, and empty states
5. Workspace admins can set a default layout; users can personalize

## Architecture

### Widget Registry Pattern

Each widget type is self-contained:
- **Config schema** (Zod) — defines tunable fields (time range, limit, filters, chart type, axes)
- **Component** — fetches data, renders chart/list, handles loading/error/empty states
- **Metadata** — title, description, default size, icon

Registry maps widget type string → { component, configSchema, metadata }.

Dashboard page reads layout from API, renders widgets from registry by type. Adding a new widget type requires only registering a new component — no changes to dashboard shell.

### Grid System

- 12-column CSS grid
- Widget sizes: small (6 col), medium (12 col), large (12 col + 2x height)
- Drag widget header to reorder, drag corner handle to resize
- Edit mode entered via "Edit Dashboard" button in header

### Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop
- `recharts` — charts (already installed)
- No new backend dependencies

## Widget Types

### Predefined Widgets (7)

| Type | Chart | Configurable Fields |
|------|-------|-------------------|
| `volume` | Area chart | time range (1h/6h/24h/7d) |
| `levels` | Bar chart | time range |
| `services` | List | limit (5/10/20), clickable to filter streams |
| `hosts` | List | limit (5/10/20), clickable to filter streams |
| `sources` | List | limit (5/10/20), clickable to filter streams |
| `errors` | Dual-line chart | time range |
| `alerts` | List | limit (5/10/20), clickable to alert detail |

### Custom SQL Widget (1)

| Type | Chart | Configurable Fields |
|------|-------|-------------------|
| `custom_sql` | Table, bar, area, line | SQL query, chart type, X axis column, Y axis column, group-by column, time range |

**SQL sandbox rules:**
- `SELECT` only — reject `INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE`
- `LIMIT 1000` enforced at query level
- Workspace scoping enforced: `WHERE workspace_id = ?` injected automatically
- Time-bounded: `WHERE timestamp >= ?` filter injected from widget `timeRange` config; user does not write time filters
- 5s execution timeout
- Results cached 30s per query hash

### Widget UI Requirements

Every widget displays:
- **Title** — descriptive name (e.g., "Log Volume — Last 24 Hours")
- **Subtitle** — what it measures (e.g., "Logs ingested per hour")
- **Tooltip** — formatted values with units on hover
- **Empty state** — "No data — add logs to see this" with context
- **Error state** — red banner with error message + retry button

## Data Model

### Schema

```sql
CREATE TABLE dashboard_layout (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id text REFERENCES user(id) ON DELETE CASCADE, -- NULL = workspace default
  layout json NOT NULL, -- array of widget configs
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dashboard_layout_workspace_idx ON dashboard_layout(workspace_id);
CREATE INDEX dashboard_layout_user_idx ON dashboard_layout(workspace_id, user_id);
```

### Widget JSON Shape

```json
{
  "id": "uuid",
  "type": "volume",
  "col": 0,
  "row": 0,
  "w": 12,
  "h": 1,
  "config": {
    "timeRange": "24h"
  }
}
```

### Layout Merge Logic

1. Load workspace default layout (`user_id = NULL`)
2. If personal layout exists (`user_id = current user`), merge:
   - Personal additions override workspace default
   - Personal removals hide workspace widgets (tracked via `hiddenIds` array)
   - Position and size always come from personal layout
3. If no workspace default exists, use built-in default: volume, levels, services, hosts

## API Endpoints

### Layout CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces/:id/dashboard/layout` | Get merged layout (workspace + personal) |
| `PUT` | `/workspaces/:id/dashboard/layout` | Save personal layout |
| `DELETE` | `/workspaces/:id/dashboard/layout` | Remove personal layout, revert to workspace default |
| `PUT` | `/workspaces/:id/dashboard/default-layout` | Set workspace default (admin only) |

### Custom SQL Query

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workspaces/:id/analytics/query` | Execute sandboxed SQL query |

Request body:
```json
{
  "sql": "SELECT level, count(*) FROM log_entry WHERE ...",
  "timeRange": "24h"
}
```

Response:
```json
{
  "columns": ["level", "count"],
  "rows": [["ERROR", 42], ["INFO", 1200]],
  "rowCount": 1242
}
```

### New Analytics Endpoints

Add endpoints for new widget types:
- `GET /workspaces/:id/analytics/sources` — top sources by log count
- `GET /workspaces/:id/analytics/errors` — error rate over time
- `GET /workspaces/:id/analytics/alerts` — recent fired alerts

## Edit Flow

1. User clicks "Edit Dashboard" button in header
2. Edit mode activates:
   - Each widget shows drag handle (top-left), resize handle (bottom-right), remove button (top-right)
   - "+" button appears in empty grid slots
   - "Save" and "Reset" buttons appear in header
3. User drags widgets to reorder, resizes via handle, removes via "×"
4. User clicks "+" → modal lists available widget types with descriptions
5. User picks widget type → widget added to grid with default size
6. User clicks widget gear icon → config panel slides out with tunable fields
7. User clicks "Save" → `PUT /dashboard/layout` with current layout
8. User clicks "Reset" → discard all changes, revert to loaded state

## Security

- SQL queries validated against dangerous keywords before execution
- `LIMIT 1000` enforced at query level via `EXECUTE` wrapper
- Workspace scoping enforced: `workspace_id` filter injected automatically
- Query runs under read-only database role
- 5s timeout prevents long-running queries
- Layout JSON validated against schema before saving

## Testing

### Contract Tests
- Layout CRUD: get, put, delete endpoints return correct shapes
- SQL query sandbox: rejects dangerous queries, enforces limits, scopes to workspace
- Analytics endpoints: return correct data shapes

### Widget Unit Tests
- Each widget renders with mock data
- Each widget handles empty state (no data)
- Each widget handles error state (fetch failure)
- Custom SQL widget validates config before rendering

### E2E Tests
- Add widget via "+" → appears in grid
- Remove widget → disappears, layout saved
- Reorder widgets via drag → positions persist after reload
- Resize widget → size persists after reload
- Personal vs workspace: admin sets default, member personalizes, merge works correctly

## Out of Scope

- Real-time widget updates (polling only, 30s interval)
- Widget sharing between workspaces
- Template library (pre-built dashboard templates)
- Export dashboard as image/PDF
- Mobile-responsive grid (desktop-first)
