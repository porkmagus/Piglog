-- ============================================================
-- Alert Events Table
-- ============================================================

CREATE TABLE IF NOT EXISTS "alert_event" (
  "id" text PRIMARY KEY,
  "alert_rule_id" text NOT NULL REFERENCES "alert_rule"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "actual_count" integer NOT NULL,
  "threshold" integer NOT NULL,
  "operator" alert_rule_operator NOT NULL,
  "status" text NOT NULL DEFAULT 'FIRED',
  "resolved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "alert_event_rule_idx" ON "alert_event"("alert_rule_id");
CREATE INDEX IF NOT EXISTS "alert_event_workspace_idx" ON "alert_event"("workspace_id");
CREATE INDEX IF NOT EXISTS "alert_event_created_idx" ON "alert_event"("created_at");
