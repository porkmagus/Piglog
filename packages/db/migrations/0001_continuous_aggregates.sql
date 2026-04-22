-- ============================================================
-- TimescaleDB Continuous Aggregates
-- ============================================================

CREATE MATERIALIZED VIEW logs_1min_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', timestamp) AS bucket,
  workspace_id,
  service,
  level,
  count(*) as count
FROM log_entry
GROUP BY bucket, workspace_id, service, level;

-- Refresh policy: every 1 minute
SELECT add_continuous_aggregate_policy('logs_1min_agg',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);
