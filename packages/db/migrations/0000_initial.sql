-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('WORKSPACE_INVITE', 'BILLING', 'LOG_SPIKE', 'THRESHOLD_BREACH', 'MENTION');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_rule_operator AS ENUM ('GREATER_THAN', 'LESS_THAN', 'EQUALS', 'CONTAINS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_rule_status AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Better Auth Tables
-- ============================================================
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "notification_preferences" json DEFAULT '{"emailNotifications":true}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "id_token" text,
  "password_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account"("provider_id", "account_id");
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account"("user_id");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires" timestamptz NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session"("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL UNIQUE,
  "expires" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "verification_identifier_value_idx" ON "verification"("identifier", "value");

-- ============================================================
-- Workspace / Tenancy
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "icon" text,
  "color" text NOT NULL DEFAULT '#5E6AD2',
  "invite_code" text NOT NULL UNIQUE,
  "owner_id" text NOT NULL REFERENCES "user"("id"),
  "plan" text NOT NULL DEFAULT 'FREE',
  "settings" json DEFAULT '{}',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "workspace_slug_idx" ON "workspace"("slug");
CREATE INDEX IF NOT EXISTS "workspace_owner_idx" ON "workspace"("owner_id");

CREATE TABLE IF NOT EXISTS "workspace_member" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" workspace_role NOT NULL DEFAULT 'MEMBER',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_member_unique_idx" ON "workspace_member"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_member_workspace_idx" ON "workspace_member"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_member_user_idx" ON "workspace_member"("user_id");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" workspace_role NOT NULL DEFAULT 'MEMBER',
  "token" text NOT NULL UNIQUE,
  "status" invite_status NOT NULL DEFAULT 'PENDING',
  "invited_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "invitation_workspace_idx" ON "invitation"("workspace_id");
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation"("email");
CREATE INDEX IF NOT EXISTS "invitation_token_idx" ON "invitation"("token");

CREATE TABLE IF NOT EXISTS "group" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text NOT NULL DEFAULT '#5E6AD2',
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "group_workspace_idx" ON "group"("workspace_id");

CREATE TABLE IF NOT EXISTS "group_member" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL REFERENCES "group"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "added_by_id" text REFERENCES "user"("id"),
  "added_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "group_member_unique_idx" ON "group_member"("group_id", "user_id");
CREATE INDEX IF NOT EXISTS "group_member_group_idx" ON "group_member"("group_id");
CREATE INDEX IF NOT EXISTS "group_member_user_idx" ON "group_member"("user_id");

-- ============================================================
-- Billing
-- ============================================================
CREATE TABLE IF NOT EXISTS "billing" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL UNIQUE REFERENCES "workspace"("id") ON DELETE CASCADE,
  "plan" text NOT NULL DEFAULT 'FREE',
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "last_invoice_id" text,
  "last_invoice_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "invoice" (
  "id" text PRIMARY KEY,
  "billing_id" text NOT NULL REFERENCES "billing"("id") ON DELETE CASCADE,
  "stripe_invoice_id" text NOT NULL UNIQUE,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "status" text NOT NULL,
  "pdf_url" text,
  "hosted_url" text,
  "period_start" timestamptz,
  "period_end" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "invoice_billing_idx" ON "invoice"("billing_id");

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS "notification" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" notification_type NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "workspace_id" text REFERENCES "workspace"("id") ON DELETE SET NULL,
  "metadata" json,
  "is_read" boolean NOT NULL DEFAULT false,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "notification_user_read_idx" ON "notification"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notification_workspace_idx" ON "notification"("workspace_id");
CREATE INDEX IF NOT EXISTS "notification_created_idx" ON "notification"("created_at");

-- ============================================================
-- Webhooks
-- ============================================================
CREATE TABLE IF NOT EXISTS "webhook" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_used_at" timestamptz,
  "failure_count" integer NOT NULL DEFAULT 0,
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "disabled_at" timestamptz,
  "disabled_reason" text
);
CREATE INDEX IF NOT EXISTS "webhook_workspace_idx" ON "webhook"("workspace_id");
CREATE INDEX IF NOT EXISTS "webhook_workspace_active_idx" ON "webhook"("workspace_id", "is_active");

CREATE TABLE IF NOT EXISTS "webhook_event" (
  "id" text PRIMARY KEY,
  "webhook_id" text NOT NULL REFERENCES "webhook"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by_id" text REFERENCES "user"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_event_unique_idx" ON "webhook_event"("webhook_id", "event");
CREATE INDEX IF NOT EXISTS "webhook_event_webhook_idx" ON "webhook_event"("webhook_id");

CREATE TABLE IF NOT EXISTS "webhook_delivery" (
  "id" text PRIMARY KEY,
  "webhook_id" text NOT NULL REFERENCES "webhook"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "payload" json NOT NULL,
  "status" delivery_status NOT NULL DEFAULT 'PENDING',
  "status_code" integer,
  "response" text,
  "error" text,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "sent_at" timestamptz,
  "delivered_at" timestamptz,
  "next_retry_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by_id" text REFERENCES "user"("id")
);
CREATE INDEX IF NOT EXISTS "webhook_delivery_webhook_created_idx" ON "webhook_delivery"("webhook_id", "created_at");
CREATE INDEX IF NOT EXISTS "webhook_delivery_webhook_status_idx" ON "webhook_delivery"("webhook_id", "status");
CREATE INDEX IF NOT EXISTS "webhook_delivery_status_retry_idx" ON "webhook_delivery"("status", "next_retry_at");

-- ============================================================
-- Log Domain
-- ============================================================
CREATE TABLE IF NOT EXISTS "log_source" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "api_key" text NOT NULL UNIQUE,
  "config" json DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "log_source_workspace_idx" ON "log_source"("workspace_id");

CREATE TABLE IF NOT EXISTS "log_stream" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "log_source"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "filter_config" json DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "log_stream_workspace_idx" ON "log_stream"("workspace_id");
CREATE INDEX IF NOT EXISTS "log_stream_source_idx" ON "log_stream"("source_id");

CREATE TABLE IF NOT EXISTS "log_entry" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "timestamp" timestamptz NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "log_source"("id") ON DELETE CASCADE,
  "level" log_level NOT NULL,
  "service" text NOT NULL,
  "host" text,
  "message" text NOT NULL,
  "metadata" jsonb,
  "trace_id" text,
  PRIMARY KEY ("id", "timestamp")
);
CREATE INDEX IF NOT EXISTS "log_entry_timestamp_idx" ON "log_entry"("timestamp");
CREATE INDEX IF NOT EXISTS "log_entry_workspace_service_level_idx" ON "log_entry"("workspace_id", "service", "level");
CREATE INDEX IF NOT EXISTS "log_entry_trace_idx" ON "log_entry"("trace_id");

CREATE TABLE IF NOT EXISTS "alert_rule" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "service" text NOT NULL,
  "level" log_level,
  "operator" alert_rule_operator NOT NULL,
  "threshold" integer NOT NULL,
  "window_minutes" integer NOT NULL DEFAULT 5,
  "status" alert_rule_status NOT NULL DEFAULT 'ACTIVE',
  "webhook_url" text,
  "last_triggered_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "alert_rule_workspace_idx" ON "alert_rule"("workspace_id");
CREATE INDEX IF NOT EXISTS "alert_rule_status_idx" ON "alert_rule"("status");

CREATE TABLE IF NOT EXISTS "saved_query" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "query_tokens" json DEFAULT '[]',
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "saved_query_workspace_idx" ON "saved_query"("workspace_id");

CREATE TABLE IF NOT EXISTS "dashboard" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "config" json DEFAULT '[]',
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "dashboard_workspace_idx" ON "dashboard"("workspace_id");

-- ============================================================
-- TimescaleDB Hypertable Setup
-- ============================================================
SELECT create_hypertable('log_entry', by_range('timestamp', INTERVAL '1 day'), if_not_exists => TRUE);

ALTER TABLE log_entry SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'workspace_id, service, level',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('log_entry', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('log_entry', INTERVAL '90 days', if_not_exists => TRUE);
