-- TimescaleDB Continuous Aggregates
-- Skipped automatically on OSS editions (license check)

DO $$
DECLARE
  license_type TEXT;
BEGIN
  SELECT edition INTO license_type FROM timescaledb_information.license;
  IF license_type = 'apache' OR license_type = 'oss' THEN
    RAISE NOTICE 'TimescaleDB OSS detected. Skipping continuous aggregates (not supported).';
    RETURN;
  END IF;

  CREATE MATERIALIZED VIEW logs_1min_agg
  WITH (timescaledb.continuous) AS
  SELECT
    time_bucket('1 minute', timestamp) AS bucket,
    workspace_id,
    service,
    level,
    count(*) as count
  FROM log_entry
  GROUP BY bucket, workspace_id, service, level
  WITH NO DATA;

  RAISE NOTICE 'Continuous aggregate created successfully.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create continuous aggregate: %', SQLERRM;
END
$$;

DO $$
DECLARE
  license_type TEXT;
BEGIN
  SELECT edition INTO license_type FROM timescaledb_information.license;
  IF license_type = 'apache' OR license_type = 'oss' THEN
    RETURN;
  END IF;

  EXECUTE $Q$SELECT add_continuous_aggregate_policy('logs_1min_agg',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
  )$Q$;

  RAISE NOTICE 'Continuous aggregate policy created successfully.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create continuous aggregate policy: %', SQLERRM;
END
$$;
