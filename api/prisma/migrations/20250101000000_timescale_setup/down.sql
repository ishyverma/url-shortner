-- Drop refresh policies
SELECT drop_continuous_aggregate_policy('click_stats_hourly');
SELECT drop_continuous_aggregate_policy('click_stats_daily');
SELECT drop_continuous_aggregate_policy('click_stats_weekly');

-- Drop compression policies
SELECT drop_compression_policy('ClickEvent');

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS click_stats_hourly;
DROP MATERIALIZED VIEW IF EXISTS click_stats_daily;
DROP MATERIALIZED VIEW IF EXISTS click_stats_weekly;

-- Drop hypertable
DROP TABLE IF EXISTS ClickEvent;

-- Disable extension (optional, keep for reuse)
-- DROP EXTENSION IF EXISTS timescaledb;