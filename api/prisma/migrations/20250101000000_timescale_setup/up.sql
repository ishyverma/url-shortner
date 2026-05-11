-- Enable TimescaleDB extension
SELECT CREATE_EXTENSION('timescaledb');

-- Convert ClickEvent to hypertable
SELECT create_hypertable('ClickEvent', 'clickedAt', 
    chunk_interval => INTERVAL '1 day',
    migrate_data => true);

-- Create continuous aggregate for hourly stats
CREATE MATERIALIZED VIEW click_stats_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', clickedAt) AS bucket,
    linkId,
    workspaceId,
    device,
    os,
    browser,
    country,
    refDomain,
    utmSource,
    utmCampaign,
    COUNT(*) AS total_clicks,
    COUNT(DISTINCT visitorHash) AS unique_visitors
FROM ClickEvent
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10;

-- Create continuous aggregate for daily stats
CREATE MATERIALIZED VIEW click_stats_daily
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', clickedAt) AS bucket,
    linkId,
    workspaceId,
    device,
    os,
    browser,
    country,
    refDomain,
    utmSource,
    utmCampaign,
    COUNT(*) AS total_clicks,
    COUNT(DISTINCT visitorHash) AS unique_visitors
FROM ClickEvent
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10;

-- Create continuous aggregate for weekly stats
CREATE MATERIALIZED VIEW click_stats_weekly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('7 days', clickedAt) AS bucket,
    linkId,
    workspaceId,
    device,
    os,
    browser,
    country,
    refDomain,
    utmSource,
    utmCampaign,
    COUNT(*) AS total_clicks,
    COUNT(DISTINCT visitorHash) AS unique_visitors
FROM ClickEvent
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10;

-- Create refresh policy for hourly aggregate
SELECT add_continuous_aggregate_policy('click_stats_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Create refresh policy for daily aggregate
SELECT add_continuous_aggregate_policy('click_stats_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- Create refresh policy for weekly aggregate
SELECT add_continuous_aggregate_policy('click_stats_weekly',
    start_offset => INTERVAL '4 weeks',
    end_offset => INTERVAL '7 days',
    schedule_interval => INTERVAL '7 days');

-- Create compression policy for old chunks
ALTER TABLE click_stats_hourly SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'linkId'
);

ALTER TABLE click_stats_daily SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'linkId'
);

ALTER TABLE click_stats_weekly SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'linkId'
);

-- Add refresh policy for compression
SELECT add_compression_policy('ClickEvent', INTERVAL '7 days');