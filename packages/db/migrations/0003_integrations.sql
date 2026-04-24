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
