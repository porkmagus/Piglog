CREATE TABLE IF NOT EXISTS dashboard_layout (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  layout json NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_layout_workspace_idx ON dashboard_layout(workspace_id);
CREATE INDEX IF NOT EXISTS dashboard_layout_user_idx ON dashboard_layout(workspace_id, user_id);
